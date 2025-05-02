<template>
  <div ref="containerRef" class="waveform-dom-canvas">
    <canvas ref="canvasRef" class="waveform-canvas"></canvas>
    <div v-if="isLoading" class="waveform-loading">
      <div class="loading-text">加载波形图中 ({{ Math.round(loadingProgress) }}%)</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { useDOMWaveformProcessor } from '~/composables/useDOMWaveformProcessor'

// 波形图采样精度控制常量 - 数值越大，精度越低，渲染越快
// 有效范围：1-10，1表示最高精度，10表示低精度高速
const waveformSamplingFactor = computed(() => {
  const max = 6
  const min = 0.5
  let factor = Math.log10(domAnnotationStore.viewportState.pixelsPerSecond / 25) * 1.5 //　对数算法
  // let factor = domAnnotationStore.viewportState.pixelsPerSecond * 4 / 255 + .5 // 线性算法
  if (factor > max) factor = max
  if (factor < min) factor = min
  console.log('sample', factor)
  return factor
})

const waveformLineWidth = computed(() => {
  const factor = Math.max(0.1, Math.log10(domAnnotationStore.viewportState.pixelsPerSecond) / 2)
  console.log('line', factor)
  return factor
})

const props = defineProps({
  width: {
    type: Number,
    default: 1000
  },
  height: {
    type: Number,
    default: 150
  },
  waveColor: {
    type: String,
    default: '#1976d2'
  },
  backgroundColor: {
    type: String,
    default: '#f5f5f5'
  }
})

// 引用元素和状态
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const isLoading = ref(false)
const loadingProgress = ref(0)
const isInitialized = ref(false)

// 使用DOM标注状态存储
const domAnnotationStore = useDOMAnnotationStore()

// 使用波形处理工具
const waveformProcessor = useDOMWaveformProcessor()

// 计算当前视口宽度
const viewportWidth = computed(() => {
  if (!containerRef.value) return props.width
  return containerRef.value.clientWidth
})

// 计算当前视口高度
const viewportHeight = computed(() => {
  if (!containerRef.value) return props.height
  return containerRef.value.clientHeight
})

// 初始化Canvas
const initCanvas = () => {
  if (!canvasRef.value || !containerRef.value) return
  
  // 设置Canvas尺寸
  const canvas = canvasRef.value
  const container = containerRef.value
  
  // 使用设备像素比例优化清晰度
  const dpr = window.devicePixelRatio || 1
  canvas.width = container.clientWidth * dpr
  canvas.height = container.clientHeight * dpr
  
  // 设置Canvas CSS尺寸
  canvas.style.width = `${container.clientWidth}px`
  canvas.style.height = `${container.clientHeight}px`
  
  // 获取绘图上下文
  const context = canvas.getContext('2d')
  if (!context) return
  
  // 根据设备像素比例缩放
  context.scale(dpr, dpr)
  
  ctx.value = context
  isInitialized.value = true
}

// 绘制波形图
const drawWaveform = () => {
  if (!ctx.value || !isInitialized.value) return
  
  const context = ctx.value
  const width = viewportWidth.value
  const height = viewportHeight.value

  
  // 清除Canvas
  context.clearRect(0, 0, width, height)
  
  // 设置背景色
  context.fillStyle = props.backgroundColor
  context.fillRect(0, 0, width, height)
  
  // 检查是否有波形数据
  const waveformData = domAnnotationStore.waveformCache.data
  if (!waveformData || waveformData.length === 0) {
    // 绘制空状态
    context.fillStyle = '#999'
    context.font = '14px Arial'
    context.textAlign = 'center'
    context.fillText('没有波形数据', width / 2, height / 2)
    return
  }
  
  // 获取当前视口状态
  const { startTime, endTime, pixelsPerSecond } = domAnnotationStore.viewportState
  
  // 获取音频参数
  const audioFile = domAnnotationStore.currentAudioFile
  // AudioFile类型没有sampleRate属性，使用默认值44100Hz
  const sampleRate = 44100
  const audioDuration = audioFile?.duration || 60
  
  // 计算所需的数据索引范围
  const totalSamples = waveformData.length
  const samplesPerSecond = totalSamples / audioDuration
  
  // 计算视图参数
  const pixelsInView = width
  const secondsInView = endTime - startTime
  const samplesInView = secondsInView * samplesPerSecond
  
  // 计算采样区间大小：每个像素对应多少个样本
  const samplesPerPixel = samplesInView / pixelsInView
  
  // 根据采样因子调整区间大小
  const bucketSize = Math.max(1, Math.floor(samplesPerPixel * waveformSamplingFactor.value))
  
  // 计算起始和结束采样点索引
  const startSampleIndex = Math.floor(startTime * samplesPerSecond)
  const endSampleIndex = Math.min(
    Math.ceil(endTime * samplesPerSecond),
    totalSamples
  )
  
  // 提取当前视口范围内的数据片段
  const visibleSamples = waveformData instanceof Float32Array 
    ? waveformData.subarray(startSampleIndex, endSampleIndex)
    : waveformData.slice(startSampleIndex, endSampleIndex)
  
  // 创建波形渲染数据：计算每个像素位置的峰值
  const pixelData = []
  const bucketCount = Math.ceil(visibleSamples.length / bucketSize)
  
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = i * bucketSize
    const bucketEnd = Math.min((i + 1) * bucketSize, visibleSamples.length)
    
    // 查找该区间的最大值和最小值
    let maxValue = 0
    let minValue = 0
    
    for (let j = bucketStart; j < bucketEnd; j++) {
      const value = visibleSamples[j]
      if (value > maxValue) maxValue = value
      if (value < minValue) minValue = value
    }
    
    // 保存该区间的波形峰值数据
    pixelData.push({ max: maxValue, min: minValue })
  }
  
  // 计算波形缩放比例（让波形高度在容器的70%范围内）
  let maxAmplitude = 0
  for (const { max, min } of pixelData) {
    const maxAbs = Math.max(Math.abs(max), Math.abs(min))
    if (maxAbs > maxAmplitude) maxAmplitude = maxAbs
  }
  
  const scaleY = maxAmplitude ? (height * 0.7) / (2 * maxAmplitude) : 1
  
  // 绘制波形
  context.beginPath()
  context.strokeStyle = props.waveColor
  context.lineWidth = waveformLineWidth.value
  
  // 居中绘制
  const center = height / 2
  
  // 采用竖线方式绘制波形
  for (let i = 0; i < pixelData.length; i++) {
    const x = (i / pixelData.length) * width
    const maxY = center - pixelData[i].max * scaleY
    const minY = center - pixelData[i].min * scaleY
    
    // 绘制从最大值到最小值的竖线
    context.beginPath()
    context.moveTo(x, maxY)
    context.lineTo(x, minY)
    context.stroke()
  }
  
  // 绘制零线
  context.beginPath()
  context.strokeStyle = 'rgba(0, 0, 0, 0.1)'
  context.lineWidth = 1
  context.moveTo(0, center)
  context.lineTo(width, center)
  context.stroke()
}

// 处理窗口大小变化
const handleResize = () => {
  if (!containerRef.value || !canvasRef.value) return
  
  initCanvas()
  drawWaveform()
}

// 监视波形数据变化
watch(() => domAnnotationStore.waveformCache.loaded, (loaded) => {
  if (loaded) {
    isLoading.value = false
    loadingProgress.value = 100
    drawWaveform()
  }
})

// 监视视口状态变化
watch(() => domAnnotationStore.viewportState, () => {
  if (domAnnotationStore.waveformCache.loaded) {
    drawWaveform()
  }
}, { deep: true })

// 生命周期钩子
onMounted(() => {
  isLoading.value = true
  loadingProgress.value = 0
  
  // 初始化Canvas
  nextTick(() => {
    initCanvas()
    
    // 设置调整大小监听
    window.addEventListener('resize', handleResize)
    
    // 如果已经加载了波形数据
    if (domAnnotationStore.waveformCache.loaded) {
      isLoading.value = false
      loadingProgress.value = 100
      drawWaveform()
    } else {
      loadingProgress.value = 30 // 等待数据
    }
  })
})

onUnmounted(() => {
  // 移除事件监听
  window.removeEventListener('resize', handleResize)
})

// 导出方法
defineExpose({
  redraw: drawWaveform
})
</script>

<style scoped>
.waveform-dom-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.waveform-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.waveform-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(245, 245, 245, 0.7);
  z-index: 2;
}

.loading-text {
  font-size: 14px;
  color: #666;
  padding: 10px 20px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
