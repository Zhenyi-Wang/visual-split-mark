import type { Ref } from 'vue'

// 区域信息接口
export interface RegionInfo {
  id: string
  isHandle: 'start' | 'end' | null
  isTextArea: boolean
  handleMode: 'both' | 'single' | 'none'
}

// 区域数据接口
export interface Region {
  start: number
  end: number
  text: string
  whisperText?: string
  createdAt?: Date
  updatedAt?: Date
}

// 按钮边界接口
export interface ButtonBounds {
  x: number
  y: number
  width: number
  height: number
}

// 音频可视化状态接口
export interface AudioVisualizerState {
  isPlaying: boolean
  duration: number
  currentTime: number
  pixelsPerSecond: number
  playbackRate: number
}

// 音频播放器接口
export interface AudioPlayer {
  audioContext: Ref<AudioContext | null>
  audioElement: Ref<HTMLAudioElement | null>
  isPlaying: Ref<boolean>
  duration: Ref<number>
  currentTime: Ref<number>
  playbackRate: Ref<number>
}

// 波形绘制器接口
export interface WaveformDrawer {
  canvas: Ref<HTMLCanvasElement | null>
  canvasCtx: Ref<CanvasRenderingContext2D | null>
  channelData: Ref<Float32Array | null>
}

// 区域管理器接口
export interface RegionManager {
  regions: Ref<Map<string, Region>>
  selectedRegion: Ref<Region | null>
  hoveredRegion: Ref<Region | null>
  editingAnnotation: Ref<Region | null>
}

// 事件处理器接口
export interface EventHandler {
  isDragging: Ref<boolean>
  isDraggingAnnotation: Ref<boolean>
  draggingHandle: Ref<'start' | 'end' | null>
}

// 回调函数类型
export type RegionClickHandler = (id: string) => void
export type AnnotationChangeHandler = (annotation: Region & { id: string }) => void
export type ButtonClickHandler = (id?: string) => void

// 音频加载进度接口
export interface AudioLoadProgress {
  phase: 'idle' | 'downloading' | 'decoding' | 'ready'
  progress: number
} 