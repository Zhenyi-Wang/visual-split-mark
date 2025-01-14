<template>
  <div class="page-container">
    <n-space vertical size="large">
      <n-page-header @back="handleBack">
        <template #title>
          音频标注 - {{ currentAudioFile?.originalName }}
        </template>
        <template #extra>
          <n-space>
            <n-button 
              type="primary" 
              ghost 
              @click="handleTranscribe" 
              :loading="transcribing"
              :disabled="!currentProject?.whisperApiUrl"
            >
              识别文本
            </n-button>
            <n-button 
              type="primary" 
              ghost 
              @click="handleExport" 
              :loading="exporting"
              :disabled="!annotations.length"
            >
              导出
            </n-button>
            <n-button type="primary" @click="handleSave" :loading="saving">
              保存
            </n-button>
          </n-space>
        </template>
      </n-page-header>

      <div class="annotation-container">
        <div class="waveform-container">
          <div ref="waveformRef" class="waveform"></div>
          <div class="waveform-controls">
            <n-space justify="center">
              <n-button circle @click="handlePlayPause">
                <template #icon>
                  <n-icon>
                    <component :is="isPlaying ? 'pause' : 'play'" />
                  </n-icon>
                </template>
              </n-button>
            </n-space>
          </div>
        </div>

        <div class="annotations-container">
          <n-scrollbar>
            <n-list>
              <n-list-item v-for="annotation in annotations" :key="annotation.id">
                <n-thing>
                  <template #header>
                    <n-space justify="space-between">
                      <n-text>{{ formatTime(annotation.start) }} - {{ formatTime(annotation.end) }}</n-text>
                      <n-space>
                        <n-button text type="primary" @click="handleEditAnnotation(annotation)">
                          编辑
                        </n-button>
                        <n-button text type="error" @click="handleDeleteAnnotation(annotation)">
                          删除
                        </n-button>
                      </n-space>
                    </n-space>
                  </template>
                  {{ annotation.text }}
                </n-thing>
              </n-list-item>
            </n-list>
          </n-scrollbar>
        </div>
      </div>
    </n-space>

    <n-modal v-model:show="showEditModal" preset="dialog" :title="isEditingAnnotation ? '编辑标注' : '添加标注'">
      <n-form
        ref="formRef"
        :model="formModel"
        :rules="rules"
      >
        <n-form-item label="开始时间" path="start">
          <n-input-number
            v-model:value="formModel.start"
            :min="0"
            :max="formModel.end"
            :precision="2"
          />
        </n-form-item>
        <n-form-item label="结束时间" path="end">
          <n-input-number
            v-model:value="formModel.end"
            :min="formModel.start"
            :precision="2"
          />
        </n-form-item>
        <n-form-item label="文本内容" path="text">
          <n-input
            v-model:value="formModel.text"
            type="textarea"
            placeholder="请输入标注内容"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="handleCancel">取消</n-button>
          <n-button type="primary" @click="handleSubmit">确定</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showDeleteModal" preset="dialog" title="删除标注" negative-text="取消" positive-text="确定" @positive-click="handleConfirmDelete">
      <n-text>确定要删除这条标注吗？此操作不可恢复。</n-text>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { useMessage } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import type { Annotation, AudioFile } from '~/types/project'
import type { WhisperResult } from '~/utils/whisper'
import { storage } from '~/utils/storage'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const message = useMessage()
const { 
  wavesurfer,
  isReady,
  isPlaying,
  initialize,
  playPause,
  addRegion,
  removeRegion,
  updateRegion,
  clearRegions
} = useWavesurfer()

const waveformRef = ref<HTMLElement | null>(null)
const formRef = ref<FormInst | null>(null)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const isEditingAnnotation = ref(false)
const annotationToDelete = ref<Annotation | null>(null)
const saving = ref(false)

const currentAudioFile = computed(() => projectStore.currentAudioFile)
const annotations = computed(() => projectStore.audioFileAnnotations)

const formModel = ref({
  id: '',
  start: 0,
  end: 0,
  text: ''
})

const rules: FormRules = {
  start: {
    required: true,
    message: '请输入开始时间',
    trigger: 'blur'
  },
  end: {
    required: true,
    message: '请输入结束时间',
    trigger: 'blur'
  },
  text: {
    required: true,
    message: '请输入标注内容',
    trigger: 'blur'
  }
}

const { transcribe } = useWhisper()
const transcribing = ref(false)
const currentProject = computed(() => projectStore.currentProject)

const { exportAnnotations } = useExport()
const exporting = ref(false)

onMounted(async () => {
  await projectStore.initialize()
  const audioFile = projectStore.audioFiles.find(f => f.id === route.params.id)
  if (!audioFile) {
    message.error('音频文件不存在')
    router.push('/')
    return
  }
  projectStore.setCurrentAudioFile(audioFile)

  // 初始化 Wavesurfer
  if (waveformRef.value) {
    try {
      await initialize(waveformRef.value, audioFile)
      // 加载标注
      annotations.value.forEach(annotation => {
        addRegion(annotation)
      })
    } catch (error) {
      console.error('Failed to initialize wavesurfer:', error)
      message.error('音频加载失败')
    }
  }
})

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const handleBack = () => {
  if (currentAudioFile.value) {
    router.push(`/project/${currentAudioFile.value.projectId}`)
  } else {
    router.push('/')
  }
}

const handlePlayPause = () => {
  playPause()
}

const handleEditAnnotation = (annotation: Annotation) => {
  isEditingAnnotation.value = true
  formModel.value = {
    id: annotation.id,
    start: annotation.start,
    end: annotation.end,
    text: annotation.text
  }
  showEditModal.value = true
}

const handleDeleteAnnotation = (annotation: Annotation) => {
  annotationToDelete.value = annotation
  showDeleteModal.value = true
}

const handleConfirmDelete = async () => {
  if (!annotationToDelete.value) return
  removeRegion(annotationToDelete.value.id)
  await projectStore.deleteAnnotation(annotationToDelete.value.id)
  message.success('标注已删除')
  showDeleteModal.value = false
}

const handleCancel = () => {
  showEditModal.value = false
  formModel.value = {
    id: '',
    start: 0,
    end: 0,
    text: ''
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    const annotation: Annotation = {
      id: formModel.value.id || Date.now().toString(),
      audioFileId: currentAudioFile.value?.id || '',
      start: formModel.value.start,
      end: formModel.value.end,
      text: formModel.value.text,
      whisperText: '',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    if (isEditingAnnotation.value) {
      updateRegion(annotation)
      await projectStore.updateAnnotation(annotation)
      message.success('标注已更新')
    } else {
      addRegion(annotation)
      await projectStore.updateAnnotation(annotation)
      message.success('标注已添加')
    }
    showEditModal.value = false
    formModel.value = {
      id: '',
      start: 0,
      end: 0,
      text: ''
    }
  } catch (error) {
    console.error('Validation failed:', error)
  }
}

const handleTranscribe = async () => {
  if (!currentAudioFile.value || !currentProject.value?.whisperApiUrl) return
  transcribing.value = true
  try {
    const annotations = await transcribe(currentAudioFile.value)
    // 更新标注
    for (const annotation of annotations) {
      addRegion(annotation)
      await projectStore.updateAnnotation(annotation)
    }
    message.success('文本识别完成')
  } catch (error) {
    console.error('Failed to transcribe:', error)
    message.error('文本识别失败')
  } finally {
    transcribing.value = false
  }
}

const handleExport = async () => {
  if (!currentAudioFile.value || !annotations.value.length) return
  exporting.value = true
  try {
    await exportAnnotations(currentAudioFile.value)
    message.success('导出成功')
  } catch (error) {
    console.error('Failed to export:', error)
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    await Promise.all([
      storage.saveProjects(projectStore.projects),
      storage.saveAudioFiles(projectStore.audioFiles),
      storage.saveAnnotations(projectStore.annotations)
    ])
    message.success('保存成功')
  } catch (error) {
    console.error('Failed to save:', error)
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.annotation-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 200px);
}

.waveform-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 200px;
}

.waveform {
  flex: 1;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.annotations-container {
  flex: 1;
  overflow: hidden;
  border: 1px solid #eee;
  border-radius: 4px;
}
</style> 