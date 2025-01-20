import { type Ref, computed } from 'vue'

interface CoordinateTransformConfig {
  startTime: Ref<number>
  endTime: Ref<number>
  width: Ref<number>
}

export function useCoordinateTransform(config: CoordinateTransformConfig) {
  // 计算每像素代表的时间
  const pixelsPerSecond = computed(() => {
    const duration = config.endTime.value - config.startTime.value
    const pps = config.width.value / duration
    console.log('[CoordinateTransform] pixelsPerSecond:', {
      duration,
      width: config.width.value,
      pps
    })
    return pps
  })

  // 将 x 坐标转换为时间
  const getTimeFromX = (x: number): number => {
    const time = config.startTime.value + (x / pixelsPerSecond.value)
    console.log('[CoordinateTransform] getTimeFromX:', {
      x,
      startTime: config.startTime.value,
      pixelsPerSecond: pixelsPerSecond.value,
      result: time
    })
    return time
  }

  // 将时间转换为 x 坐标
  const getXFromTime = (time: number): number => {
    const x = (time - config.startTime.value) * pixelsPerSecond.value
    console.log('[CoordinateTransform] getXFromTime:', {
      time,
      startTime: config.startTime.value,
      pixelsPerSecond: pixelsPerSecond.value,
      result: x
    })
    return x
  }

  // 检查时间是否在可视区域内
  const isTimeVisible = (time: number): boolean => {
    const visible = time >= config.startTime.value && time <= config.endTime.value
    console.log('[CoordinateTransform] isTimeVisible:', {
      time,
      startTime: config.startTime.value,
      endTime: config.endTime.value,
      result: visible
    })
    return visible
  }

  return {
    pixelsPerSecond,
    getTimeFromX,
    getXFromTime,
    isTimeVisible
  }
} 