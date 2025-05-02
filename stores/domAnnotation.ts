import { defineStore } from 'pinia'
import { useProjectStore } from './project'
import type { AudioFile, Annotation } from '~/types/project'

// DOM标注状态接口
interface DOMAnnotationState {
  // 视图状态
  viewportState: {
    startTime: number
    endTime: number
    pixelsPerSecond: number
    containerWidth: number
    viewportRatio: {
      start: number
      end: number
    }
  }
  // 播放状态
  playbackState: {
    isPlaying: boolean
    currentTime: number
    playbackRate: number
  }
  // UI交互状态
  uiState: {
    selectedAnnotationId: string | null
    editingAnnotationId: string | null
    isDragging: boolean
    isCreatingAnnotation: boolean
    isResizing: boolean
    resizeDirection: 'left' | 'right' | null
  }
  // 波形数据缓存
  waveformCache: {
    loaded: boolean
    data: Float32Array | number[] | null
    peaks: number[] | null
  }
  // 错误状态
  error: string | null
}

// DOM标注状态管理
export const useDOMAnnotationStore = defineStore('domAnnotation', {
  state: (): DOMAnnotationState => ({
    // 视图状态
    viewportState: {
      startTime: 0,
      endTime: 60,
      pixelsPerSecond: 100,
      containerWidth: 1000,
      viewportRatio: {
        start: 0,
        end: 1
      }
    },
    // 播放状态
    playbackState: {
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1.0
    },
    // UI交互状态
    uiState: {
      selectedAnnotationId: null,
      editingAnnotationId: null,
      isDragging: false,
      isCreatingAnnotation: false,
      isResizing: false,
      resizeDirection: null
    },
    // 波形数据缓存
    waveformCache: {
      loaded: false,
      data: null,
      peaks: null
    },
    // 错误状态
    error: null
  }),

  getters: {
    // 获取当前项目状态管理器
    projectStore: () => useProjectStore(),
    
    // 获取当前音频文件
    currentAudioFile(): AudioFile | null {
      const projectStore = useProjectStore()
      return projectStore.currentAudioFile
    },
    
    // 获取当前音频文件的标注列表
    currentAnnotations(): Annotation[] {
      const projectStore = useProjectStore()
      return projectStore.audioFileAnnotations
    },
    
    // 获取当前可见的标注列表（在视口范围内的标注）
    visibleAnnotations(): Annotation[] {
      const { startTime, endTime } = this.viewportState
      
      // 如果没有标注数据，返回空数组
      if (!this.currentAnnotations || this.currentAnnotations.length === 0) {
        return []
      }
      
      // 过滤出在当前视口范围内的标注
      return this.currentAnnotations.filter(annotation => {
        // 完全在视口之外的标注不显示
        if (annotation.end < startTime || annotation.start > endTime) {
          return false
        }
        return true
      })
    },
    
    // 格式化的音频总时长
    formattedDuration(): string {
      const audioFile = this.currentAudioFile
      if (!audioFile || !audioFile.duration) return '00:00.000'
      
      return formatTime(audioFile.duration)
    },
    
    // 格式化的当前时间
    currentTimeFormatted(): string {
      return formatTime(this.playbackState.currentTime)
    }
  },

  actions: {
    // 初始化DOM标注状态
    initialize() {
      // 重置状态到初始值
      this.resetViewport()
      this.resetPlayback()
      this.resetUIState()
      this.clearWaveformCache()
    },
    
    // 重置视图状态
    resetViewport() {
      this.viewportState = {
        startTime: 0,
        endTime: 60,
        pixelsPerSecond: 100,
        containerWidth: 1000,
        viewportRatio: {
          start: 0,
          end: 1
        }
      }
    },
    
    // 重置播放状态
    resetPlayback() {
      this.playbackState = {
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1.0
      }
    },
    
    // 重置UI交互状态
    resetUIState() {
      this.uiState = {
        selectedAnnotationId: null,
        editingAnnotationId: null,
        isDragging: false,
        isCreatingAnnotation: false,
        isResizing: false,
        resizeDirection: null
      }
    },
    
    // 清除波形数据缓存
    clearWaveformCache() {
      this.waveformCache = {
        loaded: false,
        data: null,
        peaks: null
      }
    },
    
    // 设置当前时间位置
    setCurrentTime(time: number) {
      this.playbackState.currentTime = time
    },
    
    // 设置播放状态
    setPlayingState(isPlaying: boolean) {
      this.playbackState.isPlaying = isPlaying
    },
    
    // 设置播放速率
    setPlaybackRate(rate: number) {
      this.playbackState.playbackRate = rate
    },
    
    // 缓存波形数据
    cacheWaveformData(data: Float32Array | number[], sampleRate: number, duration: number) {
      this.waveformCache.data = data
      this.waveformCache.loaded = true
      // 更新音频总时长到视图状态
      this.viewportState.endTime = duration
    },
    
    // 设置视口范围（开始和结束时间）
    setViewport(startTime: number, endTime: number) {
      this.viewportState.startTime = startTime
      this.viewportState.endTime = endTime
      
      // 根据当前音频文件的总时长更新视口比例
      const audioDuration = this.currentAudioFile?.duration || 60
      this.viewportState.viewportRatio.start = startTime / audioDuration
      this.viewportState.viewportRatio.end = endTime / audioDuration
    },
    
    // 设置缩放级别（每秒像素数）
    setZoomLevel(pixelsPerSecond: number) {
      this.viewportState.pixelsPerSecond = pixelsPerSecond
    },
    
    // 设置容器宽度
    setContainerWidth(width: number) {
      this.viewportState.containerWidth = width
    },
    
    // 设置视口比例
    setViewportRatio(start: number, end: number) {
      this.viewportState.viewportRatio.start = start
      this.viewportState.viewportRatio.end = end
    },
    
    // 选择标注
    selectAnnotation(id: string | null) {
      this.uiState.selectedAnnotationId = id
    },
    
    // 设置编辑中的标注
    setEditingAnnotation(id: string | null) {
      this.uiState.editingAnnotationId = id
    },
    
    // 设置拖拽状态
    setDragging(isDragging: boolean) {
      this.uiState.isDragging = isDragging
    },
    
    // 设置创建标注状态
    setCreatingAnnotation(isCreating: boolean) {
      this.uiState.isCreatingAnnotation = isCreating
    },
    
    // 设置调整大小状态
    setResizing(isResizing: boolean, direction: 'left' | 'right' | null = null) {
      this.uiState.isResizing = isResizing
      this.uiState.resizeDirection = direction
    },
    
    // 时间转像素位置
    timeToPixel(time: number): number {
      const { startTime, pixelsPerSecond } = this.viewportState
      return (time - startTime) * pixelsPerSecond
    },
    
    // 像素位置转时间
    pixelToTime(pixel: number): number {
      const { startTime, pixelsPerSecond } = this.viewportState
      return startTime + (pixel / pixelsPerSecond)
    }
  }
})

// 格式化时间显示 - 将其移到store外部作为辅助函数
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const ms = Math.floor((remainingSeconds - Math.floor(remainingSeconds)) * 1000)
  
  return `${minutes.toString().padStart(2, '0')}:${Math.floor(remainingSeconds).toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}
