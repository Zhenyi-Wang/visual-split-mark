import { ref, readonly } from 'vue'
import { DEFAULT_PIXELS_PER_SECOND, INITIAL_VIEWPORT_WIDTH } from '~/constants/visualizer'

export const useViewport = () => {
  // 视口范围控制
  const startTime = ref<number>(0)
  const endTime = ref<number>(0)
  const duration = ref<number>(0)

  // 设置总时长并初始化视口
  const setDuration = (value: number) => {
    duration.value = value
    
    // 根据初始渲染宽度和默认像素/秒比例计算显示时长
    const initialViewDuration = INITIAL_VIEWPORT_WIDTH / DEFAULT_PIXELS_PER_SECOND
    
    // 如果音频时长小于计算出的显示时长，显示全部
    // 否则显示计算出的时长
    setViewport(0, Math.min(value, initialViewDuration))
  }

  // 设置视口范围
  const setViewport = (start: number, end: number) => {
    startTime.value = Math.max(0, start)
    endTime.value = Math.min(duration.value, end)
  }

  // 获取视口时长
  const getViewDuration = () => {
    return endTime.value - startTime.value
  }

  // 检查时间点是否在视口范围内
  const isTimeInView = (time: number) => {
    return time >= startTime.value && time <= endTime.value
  }

  // 将全局时间转换为视口内的相对位置（0-1）
  const timeToViewportPosition = (time: number) => {
    return (time - startTime.value) / getViewDuration()
  }

  // 将视口内的相对位置（0-1）转换为全局时间
  const viewportPositionToTime = (position: number) => {
    return startTime.value + position * getViewDuration()
  }

  return {
    // 状态
    startTime: readonly(startTime),
    endTime: readonly(endTime),
    duration: readonly(duration),

    // 方法
    setDuration,
    setViewport,
    getViewDuration,
    isTimeInView,
    timeToViewportPosition,
    viewportPositionToTime
  }
} 