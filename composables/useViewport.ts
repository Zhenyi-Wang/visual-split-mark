import { ref, readonly } from 'vue'

export const useViewport = () => {
  // 视口范围控制
  const startTime = ref<number>(0)
  const endTime = ref<number>(0)
  const duration = ref<number>(0)

  // 设置总时长并初始化视口
  const setDuration = (value: number) => {
    duration.value = value
    // 初始化时设置视口范围为前30秒
    setViewport(0, Math.min(30, value))
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