
<template>
  <div class="page-container">
    <n-space vertical size="large">
      <!-- 页面头部 -->
      <n-page-header @back="handleBack">
        <template #title>
          <n-space align="center">
            <span>DOM标注 - {{ currentAudioFile?.originalName || '音频文件' }}</span>
          </n-space>
        </template>
        <template #extra>
          <n-space>
            <n-button type="primary" ghost @click="handleSwitchToCanvas">
              切换到Canvas标注
            </n-button>
          </n-space>
        </template>
      </n-page-header>

      <!-- 主要内容区域 -->
      <div class="main-content">
        <!-- 工具栏 -->
        <div class="toolbar">
          <n-space align="center">
            <!-- 播放控制 -->
            <n-button circle size="medium" title="播放/暂停" @click="togglePlay">
              <template #icon>
                <n-icon>
                  <IconPlay v-if="!isPlaying" />
                  <IconPause v-else />
                </n-icon>
              </template>
            </n-button>
            
            <!-- 时间显示 -->
            <n-text style="line-height: 34px">
              {{ domAnnotationStore.currentTimeFormatted }} / {{ domAnnotationStore.formattedDuration }}
            </n-text>
            
            <n-divider vertical style="height: 24px; margin: 5px 0" />
            
            <!-- 播放速率控制 -->
            <n-button-group>
              <n-button size="small" title="降低播放速率" @click="changePlaybackRate(-0.1)">
                <template #icon>
                  <n-icon><IconMinus /></n-icon>
                </template>
              </n-button>
              <n-text style="padding: 0 8px; line-height: 34px">{{ playbackRate }}倍播放</n-text>
              <n-button size="small" title="提高播放速率" @click="changePlaybackRate(0.1)">
                <template #icon>
                  <n-icon><IconAdd /></n-icon>
                </template>
              </n-button>
            </n-button-group>
            
            <n-divider vertical style="height: 24px; margin: 5px 0" />
            
            <!-- 缩放控制 -->
            <n-space align="center">
              <n-text style="line-height: 34px">缩放控制:</n-text>
              <ZoomControlDOM />
            </n-space>
          </n-space>

        </div>

        <!-- 内容容器 -->
        <div class="content-container">
          <!-- 视口容器 - 固定尺寸，不需要滚动 -->
          <div class="viewport-container" ref="scrollContainerRef">
            <!-- 时间轴 -->
            <div class="timeline">
              <div 
                v-for="time in timeMarkers" 
                :key="time" 
                class="timeline-marker" 
                :style="{ left: `${timeToPixel(time)}px` }"
              >
                <div class="timeline-label">{{ formatTimeAxis(time) }}</div>
              </div>
            </div>
            
            <!-- 波形区 - 固定尺寸 -->
            <div class="waveform-area">
              <WaveformDOMCanvas 
                v-if="domAnnotationStore.waveformCache.loaded" 
                @waveformClick="handleWaveformComponentClick"
              />
              <div v-else class="wave-placeholder">
                <n-spin size="medium" />
                <div class="loading-info">
                  <div>{{ loadingStatus }}</div>
                  <n-progress type="line" :percentage="loadingProgress" :show-indicator="false" />
                </div>
              </div>
            </div>
            
            <!-- 播放指示器 - 只在视口范围内显示 -->
            <div class="playhead" v-show="isPlayheadVisible">
              <div class="playhead-line"></div>
              <div class="playhead-marker"></div>
            </div>
            
            <!-- 标注区 - 固定尺寸 -->
            <AnnotationAreaDOM />
          </div>
        </div>
        
        <!-- 时间范围选择器 -->
        <div class="time-range-selector-container">
          <TimeRangeSelectorDOM />
        </div>
      </div>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useProjectStore } from '~/stores/project'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { loadAudioBlobWithProgress } from '~/utils/file'
import WaveformDOMCanvas from '~/components/WaveformDOMCanvas.vue'
import TimeRangeSelectorDOM from '~/components/TimeRangeSelectorDOM.vue'
import AnnotationAreaDOM from '~/components/AnnotationAreaDOM.vue'
import {
  Play as IconPlay,
  Pause as IconPause,
  Add as IconAdd,
  Minus as IconMinus,
  ZoomIn as IconZoomIn,
  ZoomOut as IconZoomOut
} from '@icon-park/vue-next'

// 路由和状态管理
const route = useRoute()
const router = useRouter()
const message = useMessage()
const projectStore = useProjectStore()
const domAnnotationStore = useDOMAnnotationStore()
const audioPlayer = useAudioPlayer()

// 引用和状态变量
const scrollContainerRef = ref<HTMLElement | null>(null)
const selectedAnnotationId = ref<string | null>(null)
const loadingProgress = ref(0)
const loadingStatus = ref('正在初始化...')
const playbackRate = ref(1.0)
const isPlaying = ref(false)
let playheadUpdateTimer: number | null = null


// 页面尺寸监听 - 视口大小变化时更新状态
const updateViewportSize = () => {
  if (scrollContainerRef.value) {
    const width = scrollContainerRef.value.clientWidth
    domAnnotationStore.changeContainerWidth(width)
  }
}

// 监听窗口大小变化
const handleResize = () => {
  updateViewportSize()
}

// 监听视口大小变化
watch(scrollContainerRef, () => {
  updateViewportSize()
})

// 计算属性
const currentProject = computed(() => projectStore.currentProject)
const currentAudioFile = computed(() => projectStore.currentAudioFile)

// 生成时间刻度标记
const timeMarkers = computed(() => {
  const { startTime, endTime, containerWidth, pixelsPerSecond } = domAnnotationStore.viewportState
  const duration = endTime - startTime
  const markers = []
  
  // 根据持续时间和像素密度生成合适的标记间隔
  let interval = 5 // 默认5秒一个标记
  
  // 根据像素密度和持续时间动态调整间隔
  if (pixelsPerSecond < 2) { // 非常低的分辨率
    interval = 300 // 5分钟一个标记
  } else if (pixelsPerSecond < 5) { // 低分辨率
    interval = 120 // 2分钟一个标记
  } else if (pixelsPerSecond < 10) { // 中低分辨率
    interval = 60 // 1分钟一个标记
  } else if (pixelsPerSecond < 20) { // 中等分辨率
    interval = 30 // 30秒一个标记
  } else if (pixelsPerSecond < 40) { // 中高分辨率
    interval = 15 // 15秒一个标记
  } else if (pixelsPerSecond < 80) { // 高分辨率
    interval = 5 // 5秒一个标记
  } else if (pixelsPerSecond < 160) { // 超高分辨率
    interval = 2 // 2秒一个标记
  } else { // 超高分辨率
    interval = 1 // 1秒一个标记
  }
  
  // 计算第一个标记位置（确保在视图范围内）
  const firstMarker = Math.ceil(startTime / interval) * interval
  
  // 计算最后一个标记位置（确保不超出视图范围）
  const lastMarker = Math.floor(endTime / interval) * interval
  
  // 生成标记
  for (let time = firstMarker; time <= lastMarker; time += interval) {
    markers.push(time)
  }
  
  // 如果标记太少，可以添加中间标记
  if (markers.length < 3 && interval > 1) {
    const halfInterval = interval / 2
    for (let time = firstMarker + halfInterval; time < lastMarker; time += interval) {
      markers.push(time)
    }
    // 重新排序
    markers.sort((a, b) => a - b)
  }
  
  return markers
})

// 将时间转换为像素位置
const timeToPixel = (time: number) => {
  const { startTime, endTime } = domAnnotationStore.viewportState
  const viewDuration = endTime - startTime
  return ((time - startTime) / viewDuration) * domAnnotationStore.viewportState.containerWidth
}

// 格式化时间轴刻度显示
const formatTimeAxis = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${remainingSeconds}s`
  }
}

// 计算播放头可见性
const isPlayheadVisible = computed(() => {
  const { startTime, endTime } = domAnnotationStore.viewportState
  const currentTime = audioPlayer.currentTime.value
  
  // 播放头只在视口范围内显示
  return currentTime >= startTime && currentTime <= endTime
})

// 计算播放头位置
const playheadPosition = computed(() => {
  const { startTime, endTime, containerWidth } = domAnnotationStore.viewportState
  const currentTime = audioPlayer.currentTime.value
  
  // 如果当前时间在视口范围内，计算相对位置
  if (currentTime >= startTime && currentTime <= endTime) {
    const viewDuration = endTime - startTime
    const position = ((currentTime - startTime) / viewDuration) * containerWidth - (containerWidth / 2)
    return `translateX(${position}px)`
  }
  
  // 如果当前时间不在视口范围内，不显示（实际值不重要，因为用v-show控制了可见性）
  return 'translateX(0px)'
})

// 页面加载时的初始化
onMounted(async () => {
  console.log('开始加载DOM标注页面数据')
  
  // 清空音频和标注的缓存
  domAnnotationStore.initialize()
  console.log('已清空音频和标注缓存')
  
  try {
    // 初始化项目数据
    loadingStatus.value = '正在加载项目数据...'
    loadingProgress.value = 10
    await projectStore.initialize()
    console.log('项目列表初始化完成')
    
    // 获取项目和音频文件数据
    const projectId = route.params.projectId as string
    const audioId = route.params.audioId as string
    
    loadingStatus.value = '正在加载项目详情...'
    loadingProgress.value = 20
    await projectStore.loadProject(projectId)
    
    // 获取音频文件
    const audioFile = projectStore.audioFiles.find(f => f.id === audioId)
    if (!audioFile) {
      throw new Error('未找到音频文件')
    }
    
    // 设置当前音频文件
    loadingStatus.value = '正在加载标注数据...'
    loadingProgress.value = 30
    projectStore.setCurrentAudioFile(audioFile)
    
    // 初始化视口尺寸
    updateViewportSize()
    window.addEventListener('resize', handleResize)
    
    // 加载音频文件
    try {
      loadingStatus.value = '正在加载音频文件...'
      loadingProgress.value = 40
      console.log('开始加载音频文件:', audioFile.wavPath)
      
      // 初始化音频播放器
      const channelData = await audioPlayer.initialize(audioFile)
      
      // 监听播放状态变化
      watch(audioPlayer.isPlaying, (playing) => {
        isPlaying.value = playing
        domAnnotationStore.setPlayingState(playing)
      })
      
      // 监听当前播放时间变化
      watch(audioPlayer.currentTime, (time) => {
        domAnnotationStore.setCurrentTime(time)
        
        // 自动跟随模式：当播放头接近视口边缘时自动滚动
        if (isPlaying.value) {
          const { startTime, endTime } = domAnnotationStore.viewportState
          const viewDuration = endTime - startTime
          const rightEdgeThreshold = viewDuration * 0.1 // 设置10%的右边缘阈值
          const leftEdgeThreshold = viewDuration * 0.1 // 设置10%的左边缘阈值
          
          // 如果接近右边缘，跳转视图，使播放头位于视图左侧10%位置
          if (time > endTime - rightEdgeThreshold) {
            console.log('播放头接近右边缘，重新定位视图')
            
            // 计算新的起始时间，使播放头位于视图左侧10%位置
            let newStartTime = time - viewDuration * 0.1
            let newEndTime = newStartTime + viewDuration
            
            // 边界处理
            if (newEndTime > audioPlayer.duration.value) {
              newStartTime = audioPlayer.duration.value - viewDuration
              newEndTime = audioPlayer.duration.value
            }

            domAnnotationStore.moveAndZoomView(newStartTime, newEndTime)
          }
        }
      })
      
      // 监听播放速率变化
      watch(audioPlayer.playbackRate, (rate) => {
        playbackRate.value = rate
        domAnnotationStore.setPlaybackRate(rate)
      })
      
      // 更新音频文件时长（如果与实际不符）
      loadingStatus.value = '正在处理波形数据...'
      loadingProgress.value = 85
      if (audioFile.duration !== audioPlayer.duration.value) {
        console.warn(`实际音频时长${audioPlayer.duration.value}秒与项目中的时长${audioFile.duration}秒不一致，音频id:${audioFile.id}`)
        console.warn(`更新项目中的音频时长`)
      }
      audioFile.duration = audioPlayer.duration.value

      // 缓存音频数据
      loadingStatus.value = '正在生成波形图...'
      loadingProgress.value = 90
      domAnnotationStore.cacheWaveformData(channelData, audioPlayer.audioContext.value?.sampleRate || 44100, audioPlayer.duration.value)
      
      // 设置初始视口范围 - 显示前30秒，或整个音频（如果少于30秒）
      loadingStatus.value = '加载完成'
      loadingProgress.value = 100
      const initialDuration = Math.min(30, audioPlayer.duration.value)
      domAnnotationStore.moveAndZoomView(0, initialDuration)
    } catch (error) {
      console.error('音频文件加载失败:', error)
      message.error('音频文件加载失败，请重试')
      loadingStatus.value = '音频文件加载失败'
    }

  } catch (error) {
    console.error('DOM标注页面加载失败:', error)
    message.error('加载失败，请重试')
    loadingStatus.value = '加载失败'
  }
  
  // 设置播放头更新定时器
  playheadUpdateTimer = window.setInterval(() => {
    if (isPlaying.value) {
      // 强制重新计算播放头位置
      const dummy = Date.now()
    }
  }, 50) // 每50毫秒更新一次
  
  // 注册键盘事件
  window.addEventListener('keydown', handleKeydown)
})

// 组件卸载时清理事件监听和缓存
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  // 清空缓存，避免内存泄漏
  domAnnotationStore.clearWaveformCache()
  // 销毁音频播放器
  audioPlayer.destroy()
  // 清除定时器
  if (playheadUpdateTimer !== null) {
    window.clearInterval(playheadUpdateTimer)
  }
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)
})

// 播放控制函数
const togglePlay = async () => {
  await audioPlayer.playPause()
  console.log('播放状态:', audioPlayer.isPlaying.value, domAnnotationStore.playbackState.isPlaying)
}

// 处理键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  // 空格键控制播放/暂停，但在编辑标注时不触发
  if (event.code === 'Space' && !event.repeat) {
    // 检查当前是否处于标注编辑状态
    const annotationState = domAnnotationStore.uiState.annotationState
    if (['creating_edit', 'editing_text'].includes(annotationState)) {
      // 在编辑状态下，不触发播放/暂停
      return
    }
    
    // 阻止默认行为（滚动页面等）
    event.preventDefault()
    togglePlay()
  }
}

// 调整播放速率
const changePlaybackRate = (delta: number) => {
  const newRate = Math.max(0.5, Math.min(2.0, playbackRate.value + delta))
  audioPlayer.setPlaybackRate(newRate)
}

// 波形图组件点击跳转
const handleWaveformComponentClick = (event: MouseEvent) => {
  if (!scrollContainerRef.value) return
  
  // 计算点击位置对应的时间
  const containerRect = scrollContainerRef.value.getBoundingClientRect()
  const waveformRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const offsetX = event.clientX - waveformRect.left
  const containerWidth = waveformRect.width
  
  // 计算时间点
  const { startTime, endTime } = domAnnotationStore.viewportState
  const viewDuration = endTime - startTime
  const clickTime = startTime + (offsetX / containerWidth) * viewDuration
  
  // 跳转到指定时间
  audioPlayer.seek(clickTime)
}

// 波形图点击跳转
const handleWaveformClick = (event: MouseEvent) => {
  if (!scrollContainerRef.value) return
  
  // 计算点击位置对应的时间
  const containerRect = scrollContainerRef.value.getBoundingClientRect()
  const offsetX = event.clientX - containerRect.left
  const containerWidth = containerRect.width
  
  // 计算时间点
  const { startTime, endTime } = domAnnotationStore.viewportState
  const viewDuration = endTime - startTime
  const clickTime = startTime + (offsetX / containerWidth) * viewDuration
  
  // 跳转到指定时间
  audioPlayer.seek(clickTime)
}

// 返回按钮处理
const handleBack = () => {
  router.push(`/project/${route.params.projectId}`)
}

// 切换到Canvas标注界面
const handleSwitchToCanvas = () => {
  router.push(`/project-annotation/${route.params.projectId}/${route.params.audioId}`)
}

// 页面标题设置
useHead({
  title: computed(() => `DOM标注 - ${currentAudioFile.value?.originalName || '音频文件'} - Visual Split Mark`),
})
</script>

<style scoped>
.page-container {
  position: relative;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 200px);
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 16px;
}

.toolbar {
  padding: 8px;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.content-container {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  min-height: 0;
}

.viewport-container {
  position: relative;
  overflow: hidden;
  height: 100%;
}

.timeline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  border-bottom: 1px solid #eee;
  z-index: 1;
}

.timeline-marker {
  position: absolute;
  width: 1px;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.1);
}

.timeline-label {
  position: absolute;
  top: 2px;
  transform: translateX(-50%);
  font-size: 10px;
  color: #666;
  white-space: nowrap;
}

.timeline-marker:first-child .timeline-label {
  transform: translateX(0);
  text-align: left;
}

.timeline-marker:last-child .timeline-label {
  transform: translateX(-100%);
  text-align: right;
}

.waveform-area {
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  height: 150px;
  z-index: 1;
}

.playhead {
  position: absolute;
  top: 0;
  left: 50%;
  height: 100%;
  width: 1px;
  z-index: 5;
  pointer-events: none;
  transform: v-bind('playheadPosition');
}

.playhead-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 100%;
  background-color: red;
}

.playhead-marker {
  position: absolute;
  top: 0;
  left: -5px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background-color: red;
}

.time-range-selector-container {
  padding: 0;
  background-color: #fff;
  border-radius: 4px;
}

.wave-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.loading-info {
  margin-top: 16px;
  text-align: center;
}
</style>