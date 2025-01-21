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
            <n-divider vertical style="height: 24px; margin: 5px 0;" />
            <n-space align="center">
              <n-text>渲染范围:</n-text>
              <n-input-number
                v-model:value="viewportStartPercent"
                :min="0"
                :max="maxStartPercent"
                :step="1"
                size="small"
                style="width: 80px;"
              />
              <n-text>% ({{ formatTime(viewport.startTime) }})</n-text>
              <n-text>-</n-text>
              <n-input-number
                v-model:value="viewportEndPercent"
                :min="minEndPercent"
                :max="100"
                :step="1"
                size="small"
                style="width: 80px;"
              />
              <n-text>% ({{ formatTime(viewport.endTime) }})</n-text>
            </n-space>
          </n-space>
        </div>

        <div class="content-container">
          <div class="waveform-container">
            <div ref="waveformRef" class="waveform"></div>
          </div>
        </div>
      </div>
    </n-space>

    <!-- 加载状态模态框 -->
    <n-modal
      v-model:show="isLoading"
      :mask-closable="false"
      :closable="false"
      preset="card"
      style="width: 400px;"
      class="loading-modal"
      :title="loadingDescription"
    >
      <n-space vertical justify="center" align="center">
        <n-spin size="large" />
      </n-space>
    </n-modal>

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
  </div>
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
import { useAudioPlayer, type LoadingPhase } from '~/composables/useAudioPlayer'
import { useWhisper } from '~/composables/useWhisper'
import {
  AddCircleOutline as IconZoomIn,
  RemoveCircleOutline as IconZoomOut,
  AddOutline as IconAdd,
  RemoveOutline as IconRemove
} from '@vicons/ionicons5'
import { useViewportStore } from '~/stores/viewport'
import type { MessageReactive } from 'naive-ui'
import { NSpin } from 'naive-ui'
import { unref, toRef, toRefs } from 'vue'
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const message = useMessage()
const viewport = useViewportStore()
const { transcribe } = useWhisper()

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
  clearEditingAnnotation,
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
  onDeleteButtonClick,
  updateDrawing,
  // 添加加载状态
  loadingPhase,
  loadingProgress
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

const audioPlayer = useAudioPlayer()

// 修改加载描述计算属性
const loadingDescription = computed(() => {
  const phaseText: Record<LoadingPhase, string> = {
    idle: '准备加载',
    downloading: '下载中',
    decoding: '解码中',
    ready: '加载完成'
  }
  
  const phase = loadingPhase.value
  const progress = loadingProgress.value
  const text = phaseText[phase] || '加载中'
  
  if (phase === 'ready') return ''
  
  if (phase === 'downloading' && progress === 0) {
    return text
  }
  
  return `${text} ${progress.toFixed(1)}%`
})

// 修改加载状态计算属性
const isLoading = computed({
  get: () => loadingPhase.value !== 'ready',
  set: () => {} // 模态框不需要双向绑定
})

// 修改倍速控制函数
const handleIncreaseRate = () => {
  const newRate = Math.min(5, playbackRate.value + 0.5)
  setPlaybackRate(newRate)
}

const handleDecreaseRate = () => {
  const newRate = Math.max(0.5, playbackRate.value - 0.5)
  setPlaybackRate(newRate)
}

// 添加标注处理函数
const handleAddAnnotation = () => {
  if (selectedRegion.value) {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      audioFileId: currentAudioFile.value?.id || '',
      start: selectedRegion.value.start,
      end: selectedRegion.value.end,
      text: '',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // 显示文本输入框
    pendingAnnotation.value = annotation
    annotationText.value = ''
    showTextInputModal.value = true
  }
}

// 监听文本输入框的显示状态
watch(showTextInputModal, (newValue) => {
  if (!newValue && pendingAnnotation.value) {
    // 如果关闭了文本输入框，且没有输入文本，则删除标注
    if (!annotationText.value) {
      projectStore.deleteAnnotation(pendingAnnotation.value.id)
    }
    pendingAnnotation.value = null
    annotationText.value = ''
  }
})

// 设置按钮回调函数
const setupButtonCallbacks = () => {
  // 设置按钮点击回调
  onAddButtonClick.value = handleAddAnnotation
  onEditButtonClick.value = (id) => {
    const annotation = annotations.value.find(a => a.id === id)
    if (annotation) {
      handleEditAnnotation(annotation)
    }
  }
  onDeleteButtonClick.value = (id) => {
    const annotation = annotations.value.find(a => a.id === id)
    if (annotation) {
      annotationToDelete.value = annotation
      showDeleteModal.value = true
    }
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
  
  // 设置当前音频文件
  projectStore.setCurrentAudioFile(audioFile)
  
  // 设置当前项目
  const project = projectStore.projects.find(p => p.id === audioFile.projectId)
  if (!project) {
    message.error('项目不存在')
    router.push('/')
    return
  }
  projectStore.setCurrentProject(project)
  
  // 初始化波形图
  if (!isInitialized.value && waveformRef.value) {
    try {
      await initialize(
        waveformRef.value, 
        audioFile,
        undefined,
        async (annotation) => {
          // 更新标注
          await projectStore.updateAnnotation({
            ...annotation,
            audioFileId: currentAudioFile.value?.id || '',
            text: annotation.text,
            whisperText: '',
            createdAt: new Date(),
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
      // 设置按钮回调
      setupButtonCallbacks()
    } catch (error) {
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
  pendingAnnotation.value = annotation
  annotationText.value = annotation.text || ''
  showTextInputModal.value = true
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
      clearEditingAnnotation()
    }
    showDeleteModal.value = false
    message.success('标注已删除')
  } catch (error) {
    message.error('删除失败')
  }
}

const handleCancel = () => {
  showTextInputModal.value = false
  annotationText.value = ''
  pendingAnnotation.value = null
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
    // 一次性添加所有区域
    clearRegions() // 先清除现有区域
    annotations.forEach(annotation => {
      addRegion(annotation)
    })
    message.success(`文本识别完成，共识别出 ${annotations.length} 个片段`)
  } catch (error) {
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
    message.error('保存失败')
  }
}

// 修改确认标注的处理函数
const handleConfirmAnnotation = async () => {
  if (!pendingAnnotation.value) return
  
  const annotation: Annotation = {
    ...pendingAnnotation.value,
    text: annotationText.value || '',
    whisperText: pendingAnnotation.value.whisperText || '',
    createdAt: pendingAnnotation.value.createdAt || new Date(),
    updatedAt: new Date()
  }
  
  const isNewAnnotation = !annotations.value.find(a => a.id === annotation.id)
  
  // 更新标注
  await projectStore.updateAnnotation(annotation)
  await saveToStorage() // 自动保存
  
  if (isNewAnnotation) {
    // 如果是新建标注
    addRegion(annotation)
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

// 监听标注列表的变化
watch(() => projectStore.audioFileAnnotations, (newAnnotations) => {
  // 清除所有标注区域
  clearRegions()
  // 重新添加所有标注
  newAnnotations.forEach(annotation => {
    addRegion(annotation)
  })
}, { deep: true })

// 修改 exportAnnotations 函数
const exportAnnotations = async (audioFile: AudioFile) => {
  if (!annotations.value.length) return

  // 准备导出数据
  const exportData = {
    audioFile: {
      id: audioFile.id,
      originalName: audioFile.originalName,
      duration: audioFile.duration
    },
    annotations: annotations.value.map(annotation => ({
      id: annotation.id,
      start: annotation.start,
      end: annotation.end,
      text: annotation.text,
      whisperText: annotation.whisperText,
      createdAt: annotation.createdAt,
      updatedAt: annotation.updatedAt
    }))
  }

  // 创建 Blob 对象
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  
  // 创建下载链接
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `annotations_${audioFile.originalName}.json`
  
  // 触发下载
  document.body.appendChild(link)
  link.click()
  
  // 清理
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 修改渲染范围控制相关的计算属性
const viewportStartPercent = computed({
  get: () => Math.round((viewport.startTime / duration.value) * 100),
  set: async (value) => {
    viewport.setViewport(
      (value / 100) * duration.value,
      viewport.endTime
    )
    await updateDrawing()
  }
})

const viewportEndPercent = computed({
  get: () => Math.round((viewport.endTime / duration.value) * 100),
  set: async (value) => {
    viewport.setViewport(
      viewport.startTime,
      (value / 100) * duration.value
    )
    await updateDrawing()
  }
})

// 修改范围限制
const maxStartPercent = computed(() => {
  return Math.min(viewportEndPercent.value - 1, 99)
})

const minEndPercent = computed(() => {
  return Math.max(viewportStartPercent.value + 1, 1)
})
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
  height: 100%;
}

.waveform {
  position: relative;
  width: 100%;
  height: 100%;
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

.page-container {
  min-height: 100vh;
  position: relative;
}

.loading-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

:deep(.n-card-header) {
  text-align: center;
  font-size: 16px;
  padding: 12px 0;
}

:deep(.n-card__content) {
  padding: 24px;
}

:deep(.n-spin) {
  margin: 12px 0;
}
</style> 