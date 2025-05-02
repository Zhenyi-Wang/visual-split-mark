<template>
  <div class="time-range-selector">
    <!-- 迷你波形预览和选择器容器 -->
    <div class="waveform-container" ref="miniWaveformRef">
      <!-- 迷你波形 -->
      <canvas ref="miniWaveformCanvas" class="mini-canvas"></canvas>

      <!-- 选择框 -->
      <div ref="selectionBoxRef" class="selection-box" :style="{
        left: `${previewRatio.start * 100}%`,
        width: `${(previewRatio.end - previewRatio.start) * 100}%`
      }">
        <!-- 左侧调整把手 -->
        <div ref="leftHandleRef" class="handle handle-left" style="z-index:100;" @click.prevent=""></div>

        <!-- 右侧调整把手 -->
        <div ref="rightHandleRef" class="handle handle-right"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { useDraggable, useThrottleFn } from '@vueuse/core'

// Props
const props = defineProps({
  height: {
    type: Number,
    default: 40
  }
})

// DOM 引用
const miniWaveformRef = ref<HTMLDivElement | null>(null)
const miniWaveformCanvas = ref<HTMLCanvasElement | null>(null)
const selectionBoxRef = ref<HTMLElement | null>(null)
const leftHandleRef = ref<HTMLElement | null>(null)
const rightHandleRef = ref<HTMLElement | null>(null)

// 预览状态 - 拖动过程中只更新这个状态，不触发实际渲染
const previewRatio = ref({
  start: 0,
  end: 1
})

// 使用DOM标注状态存储
const domAnnotationStore = useDOMAnnotationStore()

// 音频总时长
const audioDuration = computed(() => {
  const audioFile = domAnnotationStore.currentAudioFile
  return audioFile?.duration || 60
})

// 当前视口占比
const viewportRatio = computed(() => {
  const { startTime, endTime } = domAnnotationStore.viewportState
  const duration = audioDuration.value

  return {
    start: Math.max(0, startTime / duration),
    end: Math.min(1, endTime / duration)
  }
})

// 初始化预览状态
watch(viewportRatio, (newRatio) => {
  previewRatio.value = { ...newRatio }
}, { immediate: true })

const updateMainViewThrottled = useThrottleFn((calcRatio = true) => {
  setTimeout(() => {
    const duration = audioDuration.value
    domAnnotationStore.setViewport(
      previewRatio.value.start * duration,
      previewRatio.value.end * duration
    )

    // 计算新的缩放级别
    if (calcRatio) {
      const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration
      const containerWidth = domAnnotationStore.viewportState.containerWidth
      const newPixelsPerSecond = containerWidth / viewDuration
      domAnnotationStore.setZoomLevel(newPixelsPerSecond)
    }
  }, 0)
}, 50)

// 左侧把手拖动
const { isDragging: isLeftDragging } = useDraggable(leftHandleRef, {
  preventDefault: true,
  initialValue: { x: 0, y: 0 },
  onStart: () => {
    previewRatio.value = { ...viewportRatio.value }
  },
  onMove: async (position) => {
    if (!miniWaveformRef) return

    // 计算容器宽度和位置
    const containerWidth = miniWaveformRef.value?.clientWidth || 0
    const containerRect = miniWaveformRef.value?.getBoundingClientRect()
    if (!containerRect) return

    // 计算相对位置和比例
    const left = position.x - containerRect.left
    let newStart = Math.max(0, left / containerWidth)

    // 确保不超过右侧
    const minGap = 10 / containerWidth // 最小10像素间隔
    if (newStart > previewRatio.value.end - minGap) {
      newStart = previewRatio.value.end - minGap
    }

    // 更新预览状态
    previewRatio.value = {
      start: newStart,
      end: previewRatio.value.end
    }

    updateMainViewThrottled()
  },
  onEnd: () => {
    // // 拖动结束时强制更新一次视口状态
    // const duration = audioDuration.value
    // const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration

    // // 获取容器宽度
    // const containerWidth = domAnnotationStore.viewportState.containerWidth

    // // 计算新的缩放级别
    // const newPixelsPerSecond = containerWidth / viewDuration

    // // 更新视口状态，包括起止时间和缩放级别
    // domAnnotationStore.setViewport(
    //   previewRatio.value.start * duration,
    //   previewRatio.value.end * duration
    // )
    // domAnnotationStore.setZoomLevel(newPixelsPerSecond)
  }
})

// 右侧把手拖动
const { isDragging: isRightDragging } = useDraggable(rightHandleRef, {
  preventDefault: true,
  onStart: () => {
    previewRatio.value = { ...viewportRatio.value }
  },
  onMove: (position, event) => {
    if (!miniWaveformRef.value) return

    const containerWidth = miniWaveformRef.value.clientWidth
    const deltaX = position.x - miniWaveformRef.value.getBoundingClientRect().x

    // 转换新的结束位置
    let newEnd = deltaX / containerWidth

    // 边界检查
    if (newEnd > 1) newEnd = 1
    if (newEnd < previewRatio.value.start + 0.01) newEnd = previewRatio.value.start + 0.01

    // 更新预览状态
    previewRatio.value = {
      start: previewRatio.value.start,
      end: newEnd
    }

    // 更新实际视口状态
    updateMainViewThrottled()
    // const duration = audioDuration.value
    // const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration

    // // 计算新的缩放级别
    // const newPixelsPerSecond = containerWidth / viewDuration

    // // 更新视口状态，包括起止时间和缩放级别
    // domAnnotationStore.setViewport(
    //   previewRatio.value.start * duration,
    //   previewRatio.value.end * duration
    // )
    // domAnnotationStore.setZoomLevel(newPixelsPerSecond)
  },
  onEnd: () => {
    // // 拖动结束时更新实际视口状态
    // const duration = audioDuration.value
    // const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration

    // // 获取容器宽度
    // const containerWidth = domAnnotationStore.viewportState.containerWidth

    // // 计算新的缩放级别
    // const newPixelsPerSecond = containerWidth / viewDuration

    // // 更新视口状态，包括起止时间和缩放级别
    // domAnnotationStore.setViewport(
    //   previewRatio.value.start * duration,
    //   previewRatio.value.end * duration
    // )
    // domAnnotationStore.setZoomLevel(newPixelsPerSecond)
  }
})

let boxDrag = {
  isFirst: true,
  x: 0
}

// 整个选择框的拖动
const { isDragging: isBoxDragging } = useDraggable(selectionBoxRef, {
  preventDefault: true,
  onStart: (event) => {
    previewRatio.value = { ...viewportRatio.value }
    boxDrag.isFirst = true
  },
  onMove: (position, event) => {
    if (!miniWaveformRef.value) return

    // 防止事件冒泡
    if (isLeftDragging.value || isRightDragging.value) return

    // 初次移动时记录x坐标
    if (boxDrag.isFirst) {
      boxDrag.x = event.x
      boxDrag.isFirst = false
      return
    }

    // 计算容器宽度和位置
    const containerWidth = miniWaveformRef.value.clientWidth
    const deltaX = event.x - boxDrag.x
    boxDrag.x = event.x

    // 计算移动的比例
    const ratio = deltaX / containerWidth

    // 防止超限
    let newStart = previewRatio.value.start + ratio
    let newEnd = previewRatio.value.end + ratio

    if (newStart < 0) {
      newStart = 0
      newEnd = previewRatio.value.end - previewRatio.value.start
    } else if (newEnd > 1) {
      newEnd = 1
      newStart = 1 - (previewRatio.value.end - previewRatio.value.start)
    }

    // 更新预览状态
    previewRatio.value = {
      start: newStart,
      end: newEnd
    }


    updateMainViewThrottled(false)

    // const duration = audioDuration.value
    // domAnnotationStore.setViewport(
    //   previewRatio.value.start * duration,
    //   previewRatio.value.end * duration
    // )
  },
  onEnd: () => {
    // 拖动结束时更新实际视口状态
    const duration = audioDuration.value
    const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration

    // 获取容器宽度
    const containerWidth = domAnnotationStore.viewportState.containerWidth

    // 计算新的缩放级别
    const newPixelsPerSecond = containerWidth / viewDuration

    // 更新视口状态，包括起止时间和缩放级别
    domAnnotationStore.setViewport(
      previewRatio.value.start * duration,
      previewRatio.value.end * duration
    )
    domAnnotationStore.setZoomLevel(newPixelsPerSecond)
  }
})

// 绘制迷你波形图
const drawMiniWaveform = () => {
  if (!miniWaveformCanvas.value || !miniWaveformRef.value) return
  const WAVEFORM_SAMPLING_FACTOR = 1

  const canvas = miniWaveformCanvas.value
  const container = miniWaveformRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 设置Canvas尺寸
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight

  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 获取波形数据
  const waveformData = domAnnotationStore.waveformCache.data
  if (!waveformData || waveformData.length === 0) {
    // 绘制空状态
    ctx.fillStyle = '#ccc'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return
  }

  // 准备绘制波形
  const data = waveformData
  const step = Math.max(1, Math.floor(data.length / canvas.width * WAVEFORM_SAMPLING_FACTOR))

  // 计算波形缩放比例
  let maxAmplitude = 0
  for (let i = 0; i < data.length; i += step) {
    const value = Math.abs(data[i])
    if (value > maxAmplitude) maxAmplitude = value
  }

  const scaleY = maxAmplitude ? (canvas.height * 0.8) / (2 * maxAmplitude) : 1
  const center = canvas.height / 2

  // 绘制波形
  ctx.beginPath()
  ctx.strokeStyle = '#888'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.lineWidth = 1

  // 移动到左下角起点
  ctx.moveTo(0, center)

  const xIncrement = canvas.width / (data.length / step)
  // console.log('range selector', 'length', data.length, 'width', canvas.width, 'step', step, 'xIncrement', xIncrement)

  // 绘制上半部分波形
  let x = 0
  for (let i = 0; i < data.length; i += step) {
    if (x >= canvas.width) break

    const value = data[i] * scaleY
    ctx.lineTo(x, center - value)
    x += xIncrement
    // console.log('range selector', 'x', x, 'width', canvas.width, 'value', value)
  }

  // 绘制中间横线
  // ctx.lineTo(canvas.width, center)
  // ctx.lineTo(0, center)

  // 填充波形
  // ctx.fill()
  ctx.stroke()
}

// 监听波形数据变化
watch(() => domAnnotationStore.waveformCache.loaded, (loaded) => {
  if (loaded) {
    drawMiniWaveform()
  }
})

// 监听窗口大小变化
const handleResize = () => {
  drawMiniWaveform()
}

// 生命周期钩子
onMounted(() => {
  window.addEventListener('resize', handleResize)
  drawMiniWaveform()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.time-range-selector {
  box-sizing: border-box;
  position: relative;
  width: 100%;
  height: v-bind('`${props.height}px`');
  margin: 0;
  border-radius: 4px;
  background-color: #f9f9f9;
  overflow: hidden;
}

.waveform-container {
  box-sizing: border-box;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #f7f9fc;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.mini-canvas {
  width: 100%;
  height: 100%;
  background-color: #fafafa;
}

.selection-box {
  box-sizing: border-box;
  position: absolute;
  top: 0;
  height: 100%;
  background-color: rgba(167, 167, 167, 0.15);
  border: 1px solid rgba(65, 65, 65, 0.5);
  border-left: none;
  border-right: none;
  cursor: move;
  border-radius: 2px;
}

.handle {
  position: absolute;
  width: 8px;
  height: 100%;
  background-color: rgba(65, 65, 65, 0.5);
  cursor: ew-resize;
}

.handle-left {
  left: 0;
  border-radius: 2px 0 0 2px;
  box-shadow: -1px 0 3px rgba(0, 0, 0, 0.1);
}

.handle-right {
  right: 0;
  border-radius: 0 2px 2px 0;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.1);
}

.time-marker {
  position: absolute;
  height: 100%;
  width: 1px;
  background-color: rgba(0, 0, 0, 0.07);
  pointer-events: none;
}

.time-label {
  position: absolute;
  bottom: 4px;
  left: 2px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 1px 3px;
  border-radius: 2px;
}
</style>
