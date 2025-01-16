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
          </n-space>
        </template>
      </n-page-header>

      <div class="main-content">
        <div class="toolbar">
          <n-space align="center">
            <n-button circle @click="handlePlayPause">
              <template #icon>
                <client-only>
                  <n-icon v-if="showIcons" :size="16">
                    <icon-play v-if="!isPlaying" />
                    <icon-pause v-else />
                  </n-icon>
                </client-only>
              </template>
            </n-button>
            <n-text style="line-height: 34px;">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</n-text>
            <n-divider vertical style="height: 24px; margin: 5px 0;" />
            <n-button-group>
              <n-button @click="handleDecreaseRate" style="height: 34px;">
                <template #icon>
                  <n-icon><icon-remove /></n-icon>
                </template>
              </n-button>
              <n-text style="padding: 0 8px; line-height: 34px;">{{ playbackRate }}倍播放</n-text>
              <n-button @click="handleIncreaseRate" style="height: 34px;">
                <template #icon>
                  <n-icon><icon-add /></n-icon>
                </template>
              </n-button>
            </n-button-group>
            <n-divider vertical style="height: 24px; margin: 5px 0;" />
            <n-text v-if="selectedRegion" style="line-height: 34px;">
              选中区间：{{ formatTime(selectedRegion.start) }} - {{ formatTime(selectedRegion.end) }}
            </n-text>
            <n-divider v-if="selectedRegion" vertical style="height: 24px; margin: 5px 0;" />
            <n-button-group>
              <n-button @click="handleZoomOut" style="height: 34px;">
                <template #icon>
                  <n-icon><icon-zoom-out /></n-icon>
                </template>
              </n-button>
              <n-button @click="handleZoomIn" style="height: 34px;">
                <template #icon>
                  <n-icon><icon-zoom-in /></n-icon>
                </template>
              </n-button>
            </n-button-group>
            <n-text style="line-height: 34px;">{{ Math.round(pixelsPerSecond) }}px/s</n-text>
          </n-space>
        </div>

        <div class="content-container">
          <div class="waveform-container">
            <div ref="waveformRef" class="waveform"></div>
          </div>
        </div>
      </div>
    </n-space>
  </div>

  <!-- 添加删除确认对话框 -->
  <n-modal v-model:show="showDeleteModal" preset="dialog" title="删除标注" type="warning">
    <div>确定要删除这条标注吗？</div>
    <template #action>
      <n-space>
        <n-button @click="showDeleteModal = false">取消</n-button>
        <n-button type="error" @click="handleConfirmDelete">确定删除</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 添加标注文本输入对话框 -->
  <n-modal v-model:show="showTextInputModal" preset="dialog" :title="pendingAnnotation?.text ? '编辑标注' : '输入标注文本'">
    <n-input
      v-model:value="annotationText"
      type="textarea"
      placeholder="请输入标注文本"
      :autosize="{ minRows: 3, maxRows: 5 }"
    />
    <template #action>
      <n-space>
        <n-button @click="showTextInputModal = false">取消</n-button>
        <n-button type="primary" @click="handleConfirmAnnotation">确定</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { useMessage } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import type { ComponentPublicInstance } from 'vue'
import type { Annotation, AudioFile } from '~/types/project'
import type { WhisperResult } from '~/utils/whisper'
import { storage } from '~/utils/storage'
import { useAudioVisualizer } from '~/composables/useAudioVisualizer'
import {
  AddCircleOutline as IconZoomIn,
  RemoveCircleOutline as IconZoomOut,
  AddOutline as IconAdd,
  RemoveOutline as IconRemove
} from '@vicons/ionicons5'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const message = useMessage()

// 添加缺失的响应式变量
const transcribing = ref(false)
const exporting = ref(false)
const currentProject = computed(() => projectStore.currentProject)

const { 
  isPlaying,
  duration,
  currentTime,
  pixelsPerSecond,
  selectedRegion,
  editingAnnotation,
  initialize,
  destroy,
  playPause,
  seek,
  zoomIn,
  zoomOut,
  addRegion,
  updateRegion,
  removeRegion,
  clearRegions,
  playbackRate,
  setPlaybackRate,
  onAddButtonClick,
  onEditButtonClick,
  onDeleteButtonClick
} = useAudioVisualizer()

const waveformRef = ref<HTMLElement | null>(null)
const showDeleteModal = ref(false)
const annotationToDelete = ref<Annotation | null>(null)
const saving = ref(false)
const isInitialized = ref(false)

const currentAudioFile = computed(() => projectStore.currentAudioFile)
const annotations = computed(() => projectStore.audioFileAnnotations)

// 添加新的响应式变量
const showTextInputModal = ref(false)
const annotationText = ref('')
const pendingAnnotation = ref<Annotation | null>(null)

// 添加表单相关变量
const formRef = ref<FormInst | null>(null)
const showEditModal = ref(false)
const formModel = ref({
  id: '',
  start: 0,
  end: 0,
  text: ''
})

// 添加表单验证规则
const rules: FormRules = {
  text: [
    { required: true, message: '请输入标注文本', trigger: 'blur' }
  ],
  start: [
    { required: true, type: 'number', message: '请输入开始时间', trigger: 'blur' }
  ],
  end: [
    { required: true, type: 'number', message: '请输入结束时间', trigger: 'blur' }
  ]
}

const showIcons = ref(false)

// 修改倍速控制函数
const handleIncreaseRate = () => {
  const newRate = Math.min(5, playbackRate.value + 0.5)
  setPlaybackRate(newRate)
}

const handleDecreaseRate = () => {
  const newRate = Math.max(0.5, playbackRate.value - 0.5)
  setPlaybackRate(newRate)
}

// 初始化函数
const initializeVisualizer = async () => {
  if (isInitialized.value || !waveformRef.value) return

  const audioFile = projectStore.audioFiles.find(f => f.id === route.params.id)
  if (!audioFile) {
    message.error('音频文件不存在')
    router.push('/')
    return
  }

  try {
    await initialize(
      waveformRef.value, 
      audioFile,
      null,
      async (annotation) => {
        // 更新标注
        await projectStore.updateAnnotation({
          ...annotation,
          audioFileId: currentAudioFile.value?.id || '',
          whisperText: '',
          updatedAt: new Date()
        })
        await saveToStorage() // 自动保存
        message.success('时间已更新') // 添加提示消息
      }
    )
    isInitialized.value = true
    // 加载已有标注
    annotations.value.forEach(annotation => {
      addRegion(annotation)
    })
  } catch (error) {
    console.error('Failed to initialize audio visualizer:', error)
    message.error('音频加载失败')
  }
}

onMounted(async () => {
  await projectStore.initialize()
  const audioFile = projectStore.audioFiles.find(f => f.id === route.params.id)
  if (!audioFile) {
    message.error('音频文件不存在')
    router.push('/')
    return
  }
  projectStore.setCurrentAudioFile(audioFile)
  
  // 初始化波形图
  if (!isInitialized.value && waveformRef.value) {
    try {
      await initialize(
        waveformRef.value, 
        audioFile,
        null,
        async (annotation) => {
          // 更新标注
          await projectStore.updateAnnotation({
            ...annotation,
            audioFileId: currentAudioFile.value?.id || '',
            whisperText: '',
            updatedAt: new Date()
          })
          await saveToStorage() // 自动保存
          message.success('时间已更新') // 添加提示消息
        }
      )
      isInitialized.value = true
      // 加载已有标注
      annotations.value.forEach(annotation => {
        addRegion(annotation)
      })

      // 设置按钮点击回调
      onAddButtonClick.value = handleAddAnnotation
      onEditButtonClick.value = (id) => {
        const annotation = annotations.value.find(a => a.id === id)
        if (annotation) {
          pendingAnnotation.value = annotation
          annotationText.value = annotation.text
          showTextInputModal.value = true
        }
      }
      onDeleteButtonClick.value = (id) => {
        const annotation = annotations.value.find(a => a.id === id)
        if (annotation) {
          annotationToDelete.value = annotation
          showDeleteModal.value = true
        }
      }
    } catch (error) {
      console.error('Failed to initialize audio visualizer:', error)
      message.error('音频加载失败')
    }
  }

  // 添加一个小延迟确保 DOM 完全加载
  setTimeout(() => {
    showIcons.value = true
  }, 0)

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)

  // 手动触发一次 resize 事件以更新布局
  window.dispatchEvent(new Event('resize'))
})

onUnmounted(() => {
  destroy()
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)
})

// 添加键盘事件处理函数
const handleKeydown = (event: KeyboardEvent) => {
  // 如果当前焦点在输入框中，不处理空格键
  if (event.target instanceof HTMLInputElement || 
      event.target instanceof HTMLTextAreaElement) {
    return
  }
  
  // 处理空格键
  if (event.code === 'Space') {
    event.preventDefault() // 阻止页面滚动
    handlePlayPause()
  }
}

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

const handlePlayPause = async () => {
  if (!isInitialized.value) return
  playPause()
}

const handleEditAnnotation = (annotation: Annotation) => {
  editingAnnotation.value = annotation
  seek(annotation.start)
}

const handleDeleteClick = (annotation: Annotation | null) => {
  if (!annotation) return
  annotationToDelete.value = annotation
  showDeleteModal.value = true
}

const handleConfirmDelete = async () => {
  if (!annotationToDelete.value) return
  try {
    removeRegion(annotationToDelete.value.id)
    await projectStore.deleteAnnotation(annotationToDelete.value.id)
    await saveToStorage() // 自动保存
    if (editingAnnotation.value?.id === annotationToDelete.value.id) {
      editingAnnotation.value = null
    }
    showDeleteModal.value = false
    message.success('标注已删除')
  } catch (error) {
    console.error('Failed to delete annotation:', error)
    message.error('删除失败')
  }
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
      id: formModel.value.id,
      audioFileId: currentAudioFile.value?.id || '',
      start: Number(formModel.value.start),
      end: Number(formModel.value.end),
      text: formModel.value.text,
      whisperText: '',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    await projectStore.updateAnnotation(annotation)
    updateRegion(annotation)
    showEditModal.value = false
    message.success('标注已更新')
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

// 添加自动保存函数
const saveToStorage = async () => {
  try {
    await projectStore.saveAll()
  } catch (error) {
    console.error('Failed to save:', error)
    message.error('保存失败')
  }
}

// 修改确认标注的处理函数
const handleConfirmAnnotation = async () => {
  if (!pendingAnnotation.value) return
  
  const annotation = {
    ...pendingAnnotation.value,
    text: annotationText.value,
    updatedAt: new Date()
  }
  
  await projectStore.updateAnnotation(annotation)
  await saveToStorage() // 自动保存
  
  if (pendingAnnotation.value.text === '') {
    // 如果是新建标注
    addRegion(annotation)
    editingAnnotation.value = annotation
    message.success('标注已添加')
  } else {
    // 如果是编辑标注
    updateRegion(annotation)
    message.success('标注已更新')
  }
  
  showTextInputModal.value = false
  annotationText.value = ''
  pendingAnnotation.value = null
}

const handleZoomIn = () => {
  zoomIn()
}

const handleZoomOut = () => {
  zoomOut()
}

const handleAddAnnotation = () => {
  if (!selectedRegion.value) return
  const annotation: Annotation = {
    id: crypto.randomUUID(),
    audioFileId: currentAudioFile.value?.id || '',
    start: Number(selectedRegion.value.start.toFixed(2)),
    end: Number(selectedRegion.value.end.toFixed(2)),
    text: '',
    whisperText: '',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  pendingAnnotation.value = annotation
  showTextInputModal.value = true
}

// 监听标注列表的变化
watch(() => projectStore.audioFileAnnotations, (newAnnotations) => {
  // 清除所有标注区域
  clearRegions()
  // 重新添加所有标注
  newAnnotations.forEach(annotation => {
    addRegion(annotation)
  })
}, { deep: true })
</script>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 200px);
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 16px;
}

.toolbar {
  padding: 8px;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.toolbar :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar :deep(.n-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.content-container {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  min-height: 0;
}

.waveform-container {
  background-color: #fff;
  border-radius: 4px;
  position: relative;
  overflow: auto;
}

.waveform {
  position: relative;
  width: 100%;
  min-height: 100%;
}

.annotations-container,
.annotations-list,
.annotation-item,
.annotation-header,
.annotation-time,
.annotation-actions,
.annotation-text {
  display: none;
}
</style> 