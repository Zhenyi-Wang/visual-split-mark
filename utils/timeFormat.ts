import { PADDING, TIME_AXIS_HEIGHT, WAVEFORM_HEIGHT, ANNOTATION_HEIGHT } from '~/constants/visualizer'

/**
 * 格式化时间轴显示
 * @param seconds 秒数
 * @returns 格式化后的时间字符串
 */
export const formatTimeAxis = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }
  // 当时间间隔小于1分钟时，显示秒
  if (remainingSeconds > 0) {
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
  }
  return `${minutes}:00`
}

/**
 * 格式化播放时间显示
 * @param time 时间（秒）
 * @returns 格式化后的时间字符串
 */
export const formatPlayTime = (time: number): string => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  const milliseconds = Math.floor((time % 1) * 100)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`
}

/**
 * 获取波形图区域的Y坐标范围
 * @returns [startY, endY]
 */
export const getWaveformYRange = (): [number, number] => {
  const startY = TIME_AXIS_HEIGHT
  const endY = startY + WAVEFORM_HEIGHT
  return [startY, endY]
}

/**
 * 获取标注区域的Y坐标范围
 * @param containerHeight 容器实际高度
 * @returns [startY, endY]
 */
export const getAnnotationYRange = (containerHeight: number): [number, number] => {
  const startY = TIME_AXIS_HEIGHT + WAVEFORM_HEIGHT
  const endY = containerHeight // 使用容器实际高度作为结束位置
  return [startY, endY]
} 