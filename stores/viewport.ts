import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { DEFAULT_PIXELS_PER_SECOND, INITIAL_VIEWPORT_WIDTH } from '~/constants/visualizer'

export const useViewportStore = defineStore('viewport', () => {
  // 状态
  const startTime = ref(0)
  const endTime = ref(30)  // 默认显示前30秒
  const duration = ref(0)

  // Getters
  const viewDuration = computed(() => endTime.value - startTime.value)

  // Actions
  function setDuration(newDuration: number) {
    duration.value = newDuration
    
    // 根据初始渲染宽度和默认像素/秒比例计算显示时长
    const initialViewDuration = INITIAL_VIEWPORT_WIDTH / DEFAULT_PIXELS_PER_SECOND
    
    // 如果音频时长小于计算出的显示时长，显示全部
    // 否则显示计算出的时长
    startTime.value = 0
    endTime.value = Math.min(newDuration, initialViewDuration)
  }

  function setViewport(start: number, end: number) {
    if (start < 0 || end > duration.value || start >= end) {
      console.warn('Invalid viewport range:', { start, end, duration: duration.value })
      return
    }
    startTime.value = start
    endTime.value = end
  }

  function isTimeInViewport(time: number) {
    return time >= startTime.value && time <= endTime.value
  }

  function getTimePosition(time: number, totalWidth: number) {
    return ((time - startTime.value) / viewDuration.value) * totalWidth
  }

  return {
    // 状态
    startTime: computed(() => startTime.value),
    endTime: computed(() => endTime.value),
    duration: computed(() => duration.value),
    viewDuration,

    // Actions
    setDuration,
    setViewport,
    isTimeInViewport,
    getTimePosition,
  }
}) 