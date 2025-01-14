<template>
  <div class="page-container">
    <n-space vertical size="large">
      <n-page-header @back="handleBack">
        <template #title>
          {{ currentProject?.name }}
        </template>
        <template #extra>
          <n-space>
            <n-upload
              :accept="acceptedTypes"
              :max="1"
              :show-file-list="false"
              @change="handleFileUpload"
            >
              <n-button type="primary" :loading="isUploading">
                {{ isUploading ? '上传中...' : '上传音频' }}
              </n-button>
            </n-upload>
          </n-space>
        </template>
      </n-page-header>

      <n-card>
        <n-empty v-if="!audioFiles.length" description="暂无音频文件">
          <template #extra>
            <n-upload
              :accept="acceptedTypes"
              :max="1"
              :show-file-list="false"
              @change="handleFileUpload"
            >
              <n-button type="primary" :loading="isUploading">
                {{ isUploading ? '上传中...' : '上传音频' }}
              </n-button>
            </n-upload>
          </template>
        </n-empty>

        <template v-if="isUploading">
          <n-space vertical>
            <n-text>{{ currentStatus }}</n-text>
            <n-progress
              type="line"
              :percentage="uploadProgress"
              :height="24"
              :show-indicator="true"
              processing
            />
          </n-space>
        </template>

        <n-list v-else-if="audioFiles.length">
          <n-list-item v-for="file in audioFiles" :key="file.id">
            <n-thing>
              <template #header>
                <n-space justify="space-between">
                  <n-text>{{ file.originalName }}</n-text>
                  <n-space>
                    <n-tag :type="getStatusType(file.status)">
                      {{ getStatusText(file.status) }}
                    </n-tag>
                    <n-button
                      text
                      type="error"
                      @click="handleDeleteFile(file)"
                      :disabled="file.status === 'converting'"
                    >
                      删除
                    </n-button>
                    <n-button
                      type="primary"
                      @click="handleEditAnnotations(file)"
                      :disabled="file.status !== 'ready'"
                    >
                      标注
                    </n-button>
                  </n-space>
                </n-space>
              </template>
              <template #description>
                <n-space vertical size="small">
                  <n-text depth="3">
                    上传时间: {{ formatDate(file.createdAt) }}
                  </n-text>
                  <n-text v-if="file.duration" depth="3">
                    时长: {{ formatDuration(file.duration) }}
                  </n-text>
                </n-space>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </n-card>
    </n-space>

    <n-modal v-model:show="showDeleteModal" preset="dialog" title="删除音频文件" negative-text="取消" positive-text="确定" @positive-click="handleConfirmDelete">
      <n-text>确定要删除音频文件 "{{ fileToDelete?.originalName }}" 吗？此操作不可恢复。</n-text>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { useMessage } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import {
  NButton,
  NCard,
  NEmpty,
  NList,
  NListItem,
  NModal,
  NPageHeader,
  NProgress,
  NSpace,
  NTag,
  NText,
  NThing,
  NUpload
} from 'naive-ui'
import type { AudioFile } from '~/types/project'
import { uploader } from '~/utils/uploader'
import { nanoid } from 'nanoid'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const message = useMessage()
const { deleteFile } = useAudioConverter()

const acceptedTypes = '.mp3'
const showDeleteModal = ref(false)
const fileToDelete = ref<AudioFile | null>(null)
const uploadProgress = ref(0)
const isUploading = ref(false)
const currentStatus = ref('')

const currentProject = computed(() => projectStore.currentProject)
const audioFiles = computed(() => projectStore.projectAudioFiles)

onMounted(async () => {
  await projectStore.initialize()
  const project = projectStore.projects.find(p => p.id === route.params.id)
  if (!project) {
    message.error('项目不存在')
    router.push('/')
    return
  }
  projectStore.setCurrentProject(project)
})

const formatDate = (date: Date) => {
  return format(date, 'yyyy-MM-dd HH:mm:ss')
}

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60)
  const seconds = Math.floor(duration % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const getStatusType = (status: AudioFile['status']) => {
  switch (status) {
    case 'uploaded':
      return 'info'
    case 'converting':
      return 'warning'
    case 'ready':
      return 'success'
    case 'error':
      return 'error'
    default:
      return 'default'
  }
}

const getStatusText = (status: AudioFile['status']) => {
  switch (status) {
    case 'uploaded':
      return '已上传'
    case 'converting':
      return '转换中'
    case 'ready':
      return '就绪'
    case 'error':
      return '错误'
    default:
      return '未知'
  }
}

const handleBack = () => {
  router.push('/')
}

const handleFileUpload = async (data: { file: UploadFileInfo, fileList: UploadFileInfo[] }) => {
  const { file } = data
  if (!file.file || !currentProject.value) return
  isUploading.value = true
  currentStatus.value = '上传文件'
  
  try {
    // 生成随机文件名
    const originalId = nanoid()
    const wavId = nanoid()
    
    // 生成文件路径
    const newAudioFile: AudioFile = {
      id: nanoid(),
      projectId: currentProject.value.id,
      originalName: file.file.name,
      originalPath: `storage/uploads/${originalId}.mp3`,
      wavPath: `storage/converted/${wavId}.wav`,
      duration: 0,
      status: 'uploaded',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // 保存音频文件信息
    await projectStore.addAudioFile(newAudioFile)
    
    // 上传文件
    await uploader.saveFile(file.file, newAudioFile.originalPath, (progress: number) => {
      uploadProgress.value = progress
    })
    
    message.success('文件上传成功')

    // 开始转码
    currentStatus.value = '转换格式'
    try {
      // 调用服务器端转码 API
      await $fetch('/api/file/convert', {
        method: 'POST',
        body: {
          inputPath: newAudioFile.originalPath,
          outputPath: newAudioFile.wavPath
        }
      })
      
      // 更新音频文件状态
      await projectStore.updateAudioFile({
        ...newAudioFile,
        status: 'ready'
      })
      message.success('转码成功')
    } catch (error) {
      console.error('Conversion failed:', error)
      await projectStore.updateAudioFile({
        ...newAudioFile,
        status: 'error'
      })
      message.error('转码失败')
    }
  } catch (error) {
    console.error('File upload failed:', error)
    message.error('文件上传失败')
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
    currentStatus.value = ''
  }
}

const handleDeleteFile = (file: AudioFile) => {
  fileToDelete.value = file
  showDeleteModal.value = true
}

const handleConfirmDelete = async () => {
  if (!fileToDelete.value) return
  await deleteFile(fileToDelete.value)
  await projectStore.deleteAudioFile(fileToDelete.value.id)
  showDeleteModal.value = false
  fileToDelete.value = null
}

const handleEditAnnotations = (file: AudioFile) => {
  projectStore.setCurrentAudioFile(file)
  router.push(`/annotation/${file.id}`)
}
</script> 