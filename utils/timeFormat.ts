import { PADDING } from '~/constants/visualizer'

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
 * 从Y坐标计算时间点
 * @param y Y坐标
 * @param canvas Canvas元素
 * @param duration 音频总时长
 * @returns 时间点（秒）或null
 */
export const getTimeFromY = (y: number, canvas: HTMLCanvasElement, duration: number): number | null => {
  if (y < PADDING || y > canvas.height - PADDING) return null
  const percentage = (y - PADDING) / (canvas.height - PADDING * 2)
  return percentage * duration
}

/**
 * 从时间点计算Y坐标
 * @param time 时间点（秒）
 * @param canvas Canvas元素
 * @param duration 音频总时长
 * @returns Y坐标
 */
export const getYFromTime = (time: number, canvas: HTMLCanvasElement, duration: number): number => {
  const percentage = time / duration
  return percentage * (canvas.height - PADDING * 2) + PADDING
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