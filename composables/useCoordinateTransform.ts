import { type Ref, computed } from 'vue'
import { PADDING } from '~/constants/visualizer'

interface CoordinateTransformConfig {
  startTime: Ref<number>
  endTime: Ref<number>
  width: Ref<number>
}

export function useCoordinateTransform(config: CoordinateTransformConfig) {
  // 计算每像素代表的时间
  const pixelsPerSecond = computed(() => {
    const duration = config.endTime.value - config.startTime.value
    const pps = (config.width.value - PADDING * 2) / duration // 考虑两侧PADDING
    return pps
  })

  // 将坐标四舍五入到整数像素
  const roundToPixel = (x: number): number => {
    return Math.round(x)
  }

  // 将 x 坐标转换为时间
  const getTimeFromX = (x: number): number => {
    const time = config.startTime.value + (x - PADDING) / pixelsPerSecond.value
    return time
  }

  // 将时间转换为 x 坐标
  const getXFromTime = (time: number): number => {
    const x = (time - config.startTime.value) * pixelsPerSecond.value + PADDING
    return roundToPixel(x)
  }

  // 检查时间是否在可视区域内
  const isTimeVisible = (time: number): boolean => {
    const visible =
      time >= config.startTime.value && time <= config.endTime.value
    return visible
  }

  return {
    pixelsPerSecond,
    getTimeFromX,
    getXFromTime,
    isTimeVisible,
  }
}
