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

// 按钮边界集合接口
export interface ButtonBoundsSet {
  add: ButtonBounds | null
  edit: ButtonBounds | null
  delete: ButtonBounds | null
  mergeLeft: ButtonBounds | null
  mergeRight: ButtonBounds | null
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
export type ButtonClickHandler = (id: string) => void

// 音频加载进度接口
export interface AudioLoadProgress {
  phase: 'idle' | 'downloading' | 'decoding' | 'ready'
  progress: number
}

// 合并方向类型
export type MergeDirection = 'left' | 'right'

// 合并请求接口
export interface MergeAnnotationPayload {
  targetId: string      // 目标标注ID（被合并到的ID，即相邻标注的ID）
  sourceId: string      // 源标注ID（当前点击的标注ID）
  direction: MergeDirection  // 合并方向
}

// 合并响应接口
export interface MergeAnnotationResponse {
  success: boolean
  annotation: Region & { id: string }
} 