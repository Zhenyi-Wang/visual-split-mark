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
              :show-file-list="false"
              :disabled="isUploading || isConverting"
              @change="handleFileUpload"
            >
              <n-button type="primary" :loading="isUploading || isConverting">
                {{
                  isUploading
                    ? '上传中...'
                    : isConverting
                    ? '转换中...'
                    : '上传音频'
                }}
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
              :show-file-list="false"
              :disabled="isUploading || isConverting"
              @change="handleFileUpload"
            >
              <n-button type="primary" :loading="isUploading || isConverting">
                {{
                  isUploading
                    ? '上传中...'
                    : isConverting
                    ? '转换中...'
                    : '上传音频'
                }}
              </n-button>
            </n-upload>
          </template>
        </n-empty>

        <template v-if="isUploading || isConverting">
          <n-space vertical>
            <n-text>{{ currentStatus }}</n-text>
            <n-progress
              type="line"
              :percentage="uploadProgress"
              :height="24"
              :show-indicator="true"
              :indicator-placement="'inside'"
              :processing="true"
              :status="isConverting ? 'warning' : 'info'"
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
                  <n-text v-if="file.duration" depth="3">
                    时长: {{ formatDuration(file.duration) }}
                  </n-text>
                  <n-space align="center">
                    <n-text depth="3">
                      标注数量: {{ getAnnotationCount(file.id) }}
                    </n-text>
                    <n-text
                      v-if="file.note"
                      depth="3"
                      style="font-size: 13px; margin-left: 12px"
                    >
                      备注：{{ file.note }}
                    </n-text>
                  </n-space>
                </n-space>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </n-card>
    </n-space>

    <n-modal
      v-model:show="showDeleteModal"
      preset="dialog"
      title="删除音频文件"
      negative-text="取消"
      positive-text="确定"
      @positive-click="handleConfirmDelete"
    >
      <n-text
        >确定要删除音频文件 "{{ fileToDelete?.originalName }}"
        吗？此操作不可恢复。</n-text
      >
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
  NUpload,
  NDivider,
} from 'naive-ui'
import type { AudioFile } from '~/types/project'
import { uploader } from '~/utils/uploader'
import { nanoid } from 'nanoid'
import { storage } from '~/utils/storage'
import { useHead } from 'unhead'

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
const isConverting = ref(false)
const currentStatus = ref('')

// 修改定时器类型声明
const convertingTimer = ref<NodeJS.Timeout | null>(null)

const currentProject = computed(() => projectStore.currentProject)
const audioFiles = computed(() => projectStore.projectAudioFiles)

useHead({
  title: computed(
    () => `${currentProject.value?.name || '项目详情'} - Visual Split Mark`
  ).value,
})

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

const handleFileUpload = async (data: {
  file: UploadFileInfo
  fileList: UploadFileInfo[]
}) => {
  const { file } = data
  if (!file.file || !currentProject.value) return

  let eventSource: EventSource | null = null
  let newAudioFile: AudioFile | null = null

  try {
    // 开始上传
    isUploading.value = true
    currentStatus.value = '上传文件'

    // 生成随机文件名
    const originalId = nanoid()
    const wavId = nanoid()

    // 获取项目特定的文件路径
    const paths = storage.getAudioFilePaths(
      currentProject.value.id,
      `${originalId}.mp3`
    )
    const wavPaths = storage.getAudioFilePaths(
      currentProject.value.id,
      `${wavId}.wav`
    )

    // 创建音频文件记录
    newAudioFile = {
      id: nanoid(),
      projectId: currentProject.value.id,
      originalName: file.file.name,
      originalPath: paths.ORIGINAL,
      wavPath: wavPaths.CONVERTED,
      duration: 0,
      status: 'uploaded',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // 保存音频文件信息
    await projectStore.addAudioFile(newAudioFile)

    // 上传文件
    await uploader.saveFile(
      file.file,
      currentProject.value.id,
      `${originalId}.mp3`,
      (progress: number) => {
        uploadProgress.value = Math.floor(progress * 100 * 10) / 10
      }
    )

    message.success('文件上传成功')
    isUploading.value = false

    // 开始转码
    isConverting.value = true
    currentStatus.value = '转换格式'
    uploadProgress.value = 0

    // 创建 SSE 连接
    eventSource = new EventSource(
      `/api/file/convert-progress?fileId=${newAudioFile.id}`
    )
    eventSource.onmessage = event => {
      const data = JSON.parse(event.data)
      uploadProgress.value = data.progress
    }

    // 开始转换
    await $fetch('/api/file/convert', {
      method: 'POST',
      body: {
        inputPath: paths.ORIGINAL,
        outputPath: wavPaths.CONVERTED,
        fileId: newAudioFile.id,
      },
    })

    // 更新状态
    if (newAudioFile) {
      newAudioFile.status = 'ready'
      await projectStore.updateAudioFile(newAudioFile)
    }

    message.success('文件转换完成')
  } catch (error) {
    console.error('Error uploading file:', error)
    message.error('文件处理失败')

    // 更新状态为错误
    if (newAudioFile) {
      newAudioFile.status = 'error'
      await projectStore.updateAudioFile(newAudioFile)
    }
  } finally {
    isUploading.value = false
    isConverting.value = false
    currentStatus.value = ''
    uploadProgress.value = 0
    if (eventSource) {
      eventSource.close()
    }
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
  if (!currentProject.value?.id) {
    message.error('项目不存在')
    return
  }
  projectStore.setCurrentAudioFile(file)
  router.push(`/project-annotation/${currentProject.value.id}/${file.id}`)
}

// 添加获取标注数量的计算函数
const getAnnotationCount = (audioFileId: string) => {
  return projectStore.annotations[audioFileId]?.length || 0
}
</script>
