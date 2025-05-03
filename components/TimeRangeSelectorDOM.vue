<template>
  <div class="time-range-selector">
    <!-- 迷你波形预览和选择器容器 -->
    <div class="waveform-container" ref="miniWaveformRef" @wheel="handleWheel" @click="handleWaveformClick">
      <!-- 迷你波形 -->
      <canvas ref="miniWaveformCanvas" class="mini-canvas"></canvas>

      <!-- 选择框 -->
      <div ref="selectionBoxRef" class="selection-box"
        :style="{ left: `${selectionBoxStyleLeftPx}px`, width: `${selectionBoxStyleWidthPx}px` }">
        <!-- 左侧调整把手 -->
        <!-- <div ref="leftHandleRef" class="handle handle-left" style="z-index:100;" @click.prevent=""></div> -->

        <!-- 右侧调整把手 -->
        <!-- <div ref="rightHandleRef" class="handle handle-right"></div> -->
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
// const leftHandleRef = ref<HTMLElement | null>(null)
// const rightHandleRef = ref<HTMLElement | null>(null)

// 预览状态 - 拖动过程中只更新这个状态，不触发实际渲染
const previewRatio = ref({
  start: 0,
  end: 1
})

// 处理滚轮事件
const handleWheel = (event: WheelEvent) => {
  // console.log('TimeRangeSelector wheel event:', {
  //   deltaX: event.deltaX,
  //   deltaY: event.deltaY,
  //   deltaZ: event.deltaZ,
  //   deltaMode: event.deltaMode,
  //   clientX: event.clientX,
  //   clientY: event.clientY,
  //   offsetX: event.offsetX,
  //   offsetY: event.offsetY
  // })

  if (!miniWaveformRef?.value?.clientWidth) return

  // 根据offsetX、容器宽度、视口数据，计算鼠标所在位置的时间
  const containerWidth = miniWaveformRef.value.clientWidth || 0
  // 计算相对于波形容器的x坐标
  const offsetX = event.clientX - miniWaveformRef.value.getBoundingClientRect().left
  const time = (offsetX / containerWidth) * audioDuration.value
  // console.log('time args:', { containerWidth, offsetX, time, clientX: event.clientX, left: miniWaveformRef.value.getBoundingClientRect().left })

  // 上移
  if (event.deltaY < 0) {
    domAnnotationStore.zoomInView(time)
  } else if (event.deltaY > 0) {
    domAnnotationStore.zoomOutView(time)
  }

  // 阻止默认行为，避免页面滚动
  event.preventDefault()
}

// 点击跳转视口
const handleWaveformClick = (event: PointerEvent) => {
  if (!miniWaveformRef.value?.getClientRects()) return
  if (event.target !== miniWaveformCanvas.value) return
  // console.log(event.target,miniWaveformCanvas.value)
  event.preventDefault()

  // 当前视口信息
  const { startTime, endTime } = domAnnotationStore.viewportState

  // 鼠标相对位置和时间
  const pointerX = event.clientX - miniWaveformRef.value.getClientRects()[0].x
  const pointerRatio = pointerX / miniWaveformRef.value.clientWidth
  const pointerTime = pointerRatio * domAnnotationStore.audioDuration

  // 计算新的视口位置
  const viewDuration = endTime - startTime
  let newStartTime = pointerTime - viewDuration / 2
  let newEndTime = pointerTime + viewDuration / 2
  console.log(111, { startTime, endTime, pointerTime, pointerX, clientX: event.clientX, canvasX: miniWaveformRef.value.getClientRects()[0].x, viewDuration, newStartTime, newEndTime })

  // 边界处理
  if (newStartTime < 0) {
    newStartTime = 0
    newEndTime = viewDuration
  }

  if (newEndTime > audioDuration.value) {
    newStartTime = audioDuration.value - viewDuration
    newEndTime = audioDuration.value
  }

  console.log(222, { newStartTime, newEndTime })

  domAnnotationStore.moveAndZoomView(newStartTime, newEndTime)
}


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

const SELECTION_PADDING_PX = 2
const SELECTION_PADDING_THRESHOLD_PX = 20

const selectionBoxPureLeftPx = computed(() => {
  if (!miniWaveformRef.value?.clientWidth) return 0
  const containerWidth = miniWaveformRef.value.clientWidth
  return containerWidth * viewportRatio.value.start
})

const selectionBoxPureWidthPx = computed(() => {
  if (!miniWaveformRef.value?.clientWidth) return 0
  const containerWidth = miniWaveformRef.value?.clientWidth
  return containerWidth * (previewRatio.value.end - previewRatio.value.start)
})

const selectionBoxNeedsPadding = computed(() => {
  return selectionBoxPureWidthPx.value < SELECTION_PADDING_THRESHOLD_PX
})

const selectionBoxStyleLeftPx = computed(() => {
  if (!miniWaveformRef.value?.clientWidth) return 0

  if (selectionBoxNeedsPadding.value) {
    return selectionBoxPureLeftPx.value - SELECTION_PADDING_PX
  }
  return selectionBoxPureLeftPx.value
})

const selectionBoxStyleWidthPx = computed(() => {
  if (!miniWaveformRef.value?.clientWidth) return 0

  if (selectionBoxNeedsPadding.value) {
    return selectionBoxPureWidthPx.value + SELECTION_PADDING_PX * 2
  }
  return selectionBoxPureWidthPx.value
})

// 初始化预览状态
watch(viewportRatio, (newRatio) => {
  previewRatio.value = { ...newRatio }
}, { immediate: true })

// 更新主视图
const updateMainViewThrottled = useThrottleFn((justMove = false) => {
  setTimeout(() => {
    const duration = audioDuration.value

    // 如果只是移动，没有缩放
    if (justMove) {
      domAnnotationStore.moveView(previewRatio.value.start * duration)
      return
    }

    // 涉及缩放
    domAnnotationStore.moveAndZoomView(previewRatio.value.start * duration, previewRatio.value.end * duration)
  }, 0)
}, 50)

// // 左侧把手拖动
// const { isDragging: isLeftDragging } = useDraggable(leftHandleRef, {
//   preventDefault: true,
//   initialValue: { x: 0, y: 0 },
//   onStart: () => {
//     previewRatio.value = { ...viewportRatio.value }
//   },
//   onMove: async (position) => {
//     if (!miniWaveformRef) return

//     // 计算容器宽度和位置
//     const containerWidth = miniWaveformRef.value?.clientWidth || 0
//     const containerRect = miniWaveformRef.value?.getBoundingClientRect()
//     if (!containerRect) return

//     // 计算相对位置和比例
//     const left = position.x - containerRect.left
//     let newStart = Math.max(0, left / containerWidth)

//     // 确保不超过右侧
//     const minGap = 10 / containerWidth // 最小10像素间隔
//     if (newStart > previewRatio.value.end - minGap) {
//       newStart = previewRatio.value.end - minGap
//     }

//     // 更新预览状态
//     previewRatio.value = {
//       start: newStart,
//       end: previewRatio.value.end
//     }

//     updateMainViewThrottled(false)
//   },
//   onEnd: () => {
//     // // 拖动结束时强制更新一次视口状态
//     // const duration = audioDuration.value
//     // const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration

//     // // 获取容器宽度
//     // const containerWidth = domAnnotationStore.viewportState.containerWidth

//     // // 计算新的缩放级别
//     // const newPixelsPerSecond = containerWidth / viewDuration

//     // // 更新视口状态，包括起止时间和缩放级别
//     // domAnnotationStore.setViewport(
//     //   previewRatio.value.start * duration,
//     //   previewRatio.value.end * duration
//     // )
//     // domAnnotationStore.setZoomLevel(newPixelsPerSecond)
//   }
// })

// // 右侧把手拖动
// const { isDragging: isRightDragging } = useDraggable(rightHandleRef, {
//   preventDefault: true,
//   onStart: () => {
//     previewRatio.value = { ...viewportRatio.value }
//   },
//   onMove: (position, event) => {
//     if (!miniWaveformRef.value) return

//     const containerWidth = miniWaveformRef.value.clientWidth
//     const deltaX = position.x - miniWaveformRef.value.getBoundingClientRect().x

//     // 转换新的结束位置
//     let newEnd = deltaX / containerWidth

//     // 边界检查
//     if (newEnd > 1) newEnd = 1
//     if (newEnd < previewRatio.value.start + 0.01) newEnd = previewRatio.value.start + 0.01

//     // 更新预览状态
//     previewRatio.value = {
//       start: previewRatio.value.start,
//       end: newEnd
//     }

//     // 更新实际视口状态
//     updateMainViewThrottled(false)
//     // const duration = audioDuration.value
//     // const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration

//     // // 计算新的缩放级别
//     // const newPixelsPerSecond = containerWidth / viewDuration

//     // // 更新视口状态，包括起止时间和缩放级别
//     // domAnnotationStore.setViewport(
//     //   previewRatio.value.start * duration,
//     //   previewRatio.value.end * duration
//     // )
//     // domAnnotationStore.setZoomLevel(newPixelsPerSecond)
//   },
//   onEnd: () => {
//     // // 拖动结束时更新实际视口状态
//     // const duration = audioDuration.value
//     // const viewDuration = (previewRatio.value.end - previewRatio.value.start) * duration

//     // // 获取容器宽度
//     // const containerWidth = domAnnotationStore.viewportState.containerWidth

//     // // 计算新的缩放级别
//     // const newPixelsPerSecond = containerWidth / viewDuration

//     // // 更新视口状态，包括起止时间和缩放级别
//     // domAnnotationStore.setViewport(
//     //   previewRatio.value.start * duration,
//     //   previewRatio.value.end * duration
//     // )
//     // domAnnotationStore.setZoomLevel(newPixelsPerSecond)
//   }
// })

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

    // // 防止事件冒泡
    // if (isLeftDragging.value || isRightDragging.value) return

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


    updateMainViewThrottled(true)

    // const duration = audioDuration.value
    // domAnnotationStore.setViewport(
    //   previewRatio.value.start * duration,
    //   previewRatio.value.end * duration
    // )
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
  
  // 计算每个像素对应的采样点数量
  const pixelsAvailable = canvas.width
  const samplesPerPixel = Math.max(1, Math.floor(data.length / pixelsAvailable * WAVEFORM_SAMPLING_FACTOR))
  
  // 创建波形渲染数据：计算每个像素位置的峰值
  const pixelData = []
  const bucketCount = Math.ceil(data.length / samplesPerPixel)
  
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = i * samplesPerPixel
    const bucketEnd = Math.min((i + 1) * samplesPerPixel, data.length)
    
    // 查找该区间的最大值和最小值
    let maxValue = 0
    let minValue = 0
    
    for (let j = bucketStart; j < bucketEnd; j++) {
      const value = data[j]
      if (value > maxValue) maxValue = value
      if (value < minValue) minValue = value
    }
    
    // 保存该区间的波形峰值数据
    pixelData.push({ max: maxValue, min: minValue })
  }

  // 计算波形缩放比例
  let maxAmplitude = 0
  for (const { max, min } of pixelData) {
    const maxAbs = Math.max(Math.abs(max), Math.abs(min))
    if (maxAbs > maxAmplitude) maxAmplitude = maxAbs
  }

  const scaleY = maxAmplitude ? (canvas.height * 0.8) / (2 * maxAmplitude) : 1
  const center = canvas.height / 2

  // 绘制波形
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 1
  
  // 采用竖线方式绘制波形
  for (let i = 0; i < pixelData.length; i++) {
    // 确保波形图水平分布在整个Canvas宽度上
    const x = Math.floor((i * canvas.width) / pixelData.length)
    const maxY = center - pixelData[i].max * scaleY
    const minY = center - pixelData[i].min * scaleY
    
    // 绘制从最大值到最小值的竖线
    ctx.beginPath()
    ctx.moveTo(x, maxY)
    ctx.lineTo(x, minY)
    ctx.stroke()
  }
  
  // 绘制零线
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.lineWidth = 1
  ctx.moveTo(0, center)
  ctx.lineTo(canvas.width, center)
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
  padding: v-bind("selectionBoxNeedsPadding ? '0 ' + SELECTION_PADDING_PX + 'px' : 0");
  background-color: rgba(167, 167, 167, 0.15);
  border: 1px solid rgba(65, 65, 65, 0.5);
  /* border-left: none;
  border-right: none; */
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
