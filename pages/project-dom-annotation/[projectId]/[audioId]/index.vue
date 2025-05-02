
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
            <n-button circle size="medium" title="播放/暂停">
              <template #icon>
                <n-icon>
                  <IconPlay />
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
              <n-button size="small" title="降低播放速率">
                <template #icon>
                  <n-icon><IconMinus /></n-icon>
                </template>
              </n-button>
              <n-text style="padding: 0 8px; line-height: 34px">1.0倍播放</n-text>
              <n-button size="small" title="提高播放速率">
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

          <n-divider vertical style="height: 24px; margin: 5px 0" />
        </div>

        <!-- 内容容器 -->
        <div class="content-container">
          <!-- 视口容器 - 固定尺寸，不需要滚动 -->
          <div class="viewport-container" ref="scrollContainerRef">
            <!-- 波形区 - 固定尺寸 -->
            <div class="waveform-area">
              <WaveformDOMCanvas v-if="domAnnotationStore.waveformCache.loaded" />
              <div v-else class="wave-placeholder">波形区 - 正在加载音频数据</div>
            </div>
            
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
            
            <!-- 播放指示器 - 固定在视口中央 -->
            <div class="playhead">
              <div class="playhead-line"></div>
              <div class="playhead-marker"></div>
            </div>
            
            <!-- 标注区 - 固定尺寸 -->
            <div class="annotation-area">
              <!-- 根据标注数据渲染标注项 -->
              <div 
                v-for="annotation in visibleAnnotations" 
                :key="annotation.id"
                class="annotation-item"
                :class="{ 'annotation-selected': annotation.id === selectedAnnotationId }"
                :style="getAnnotationStyle(annotation)"
                @click="handleAnnotationClick(annotation)"
              >
                <div class="annotation-content">{{ annotation.text || '(无文本)' }}</div>
                <div class="annotation-handle annotation-handle-left"></div>
                <div class="annotation-handle annotation-handle-right"></div>
              </div>
            </div>
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useProjectStore } from '~/stores/project'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { loadAudioBlobWithProgress } from '~/utils/file'
import WaveformDOMCanvas from '~/components/WaveformDOMCanvas.vue'
import TimeRangeSelectorDOM from '~/components/TimeRangeSelectorDOM.vue'
import ZoomControlDOM from '~/components/ZoomControlDOM.vue'
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

// 引用和状态变量
const scrollContainerRef = ref<HTMLElement | null>(null)
const selectedAnnotationId = ref<string | null>(null)

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

// 计算可见标注
const visibleAnnotations = computed(() => {
  return domAnnotationStore.visibleAnnotations
})

// 生成时间刻度标记
const timeMarkers = computed(() => {
  const { startTime, endTime } = domAnnotationStore.viewportState
  const duration = endTime - startTime
  const markers = []
  
  // 根据持续时间生成合适的标记间隔
  let interval = 5 // 默认5秒一个标记
  
  if (duration > 300) { // 大于5分钟
    interval = 60 // 1分钟一个标记
  } else if (duration > 60) { // 大于1分钟
    interval = 15 // 15秒一个标记
  } else if (duration > 30) { // 大于30秒
    interval = 10 // 10秒一个标记
  }
  
  // 计算第一个标记位置
  const firstMarker = Math.ceil(startTime / interval) * interval
  
  // 生成标记
  for (let time = firstMarker; time <= endTime; time += interval) {
    markers.push(time)
  }
  
  return markers
})

// 将时间转换为像素位置
const timeToPixel = (time: number) => {
  const { startTime, endTime, containerWidth } = domAnnotationStore.viewportState
  const viewDuration = endTime - startTime
  return ((time - startTime) / viewDuration) * containerWidth
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

// 获取标注样式
const getAnnotationStyle = (annotation: any) => { // 使用any类型避免类型错误
  // 计算标注的位置和宽度
  const left = timeToPixel(annotation.start)
  const right = timeToPixel(annotation.end)
  const width = right - left
  return {
    left: `${left}px`,
    width: `${width}px`
  }
}

// 处理标注点击
const handleAnnotationClick = (annotation: any) => { // 使用any类型避免类型错误
  selectedAnnotationId.value = annotation.id
  domAnnotationStore.selectAnnotation(annotation.id)
}

// 页面加载时的初始化
onMounted(async () => {
  console.log('开始加载DOM标注页面数据')
  
  try {
    // 初始化项目数据
    await projectStore.initialize()
    console.log('项目列表初始化完成')
    
    // 获取项目和音频文件数据
    const projectId = route.params.projectId as string
    const audioId = route.params.audioId as string
    
    // 加载项目详情
    await projectStore.loadProject(projectId)
    console.log('项目详细数据加载完成')
    
    // 设置当前音频文件
    const audioFile = projectStore.projectAudioFiles.find(f => f.id === audioId)
    if (!audioFile) {
      throw new Error('找不到音频文件')
    }
    
    // 设置当前音频文件
    projectStore.setCurrentAudioFile(audioFile)
    
    // 初始化视口尺寸
    updateViewportSize()
    window.addEventListener('resize', handleResize)
    
    // 加载音频文件
    try {
      console.log('开始加载音频文件:', audioFile.wavPath)
      // 使用文件工具加载音频文件blob和音频数据
      const { blob, audioBuffer } = await loadAudioBlobWithProgress(
        audioFile.wavPath,
        (phase, progress) => {
          console.log(`音频加载阶段: ${phase}, 进度: ${progress}%`)
        }
      )
      
      // 从AudioBuffer中获取音频数据数组
      const channelData = audioBuffer.getChannelData(0)
      
      // 打印音频基本信息
      console.log('音频文件加载完成')
      console.log('音频时长:', audioBuffer.duration, '秒')
      console.log('采样率:', audioBuffer.sampleRate, 'Hz')
      console.log('声道数:', audioBuffer.numberOfChannels)

      // 对比音频时长和项目中的时长
      if (Math.abs(audioBuffer.duration - audioFile.duration) > 0.1) {
        console.warn(`实际音频时长${audioBuffer.duration}秒与项目中的时长${audioFile.duration}秒不一致，音频id:${audioFile.id}`)
        audioFile.duration = audioBuffer.duration
        console.warn(`更新项目中的音频时长`)
      }

      // 缓存音频数据
      domAnnotationStore.cacheWaveformData(channelData, audioBuffer.sampleRate, audioBuffer.duration)
      
      // 设置初始视口范围 - 显示前30秒，或整个音频（如果少于30秒）
      const initialDuration = Math.min(30, audioBuffer.duration)
      domAnnotationStore.moveAndZoomView(0, initialDuration)
    } catch (error) {
      console.error('音频文件加载失败:', error)
      message.error('音频文件加载失败，请重试')
    }

  } catch (error) {
    console.error('DOM标注页面加载失败:', error)
    message.error('加载失败，请重试')
  }
})

// 组件卸载时清理事件监听
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

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

.waveform-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 150px;
  z-index: 1;
}

.timeline {
  position: absolute;
  top: 150px;
  left: 0;
  right: 0;
  height: 20px;
  border-top: 1px solid #eee;
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
}

.playhead {
  position: absolute;
  top: 0;
  left: 50%;
  height: 100%;
  width: 1px;
  z-index: 5;
  pointer-events: none;
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

.annotation-area {
  position: absolute;
  top: 170px;
  width: 100%;
  height: 200px;
  pointer-events: none;
}

.annotation-item {
  box-sizing: border-box;
  position: absolute;
  height: 40px;
  background-color: rgba(64, 158, 255, 0.2);
  border: 1px solid #409eff;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  pointer-events: all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  padding: 0 6px;
}

.annotation-item:hover {
  background-color: rgba(64, 158, 255, 0.3);
}

.annotation-selected {
  background-color: rgba(64, 158, 255, 0.4);
  border: 2px solid #2c8af8;
  z-index: 2;
}

.annotation-content {
  font-size: calc(11px + v-bind('Math.min(1, domAnnotationStore.viewportState.pixelsPerSecond / 50)') * 3px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
}

.annotation-handle {
  position: absolute;
  width: 4px;
  height: 100%;
  top: 0;
  background-color: rgba(64, 158, 255, 0.5);
  cursor: ew-resize;
}

.annotation-handle-left {
  left: 0;
  border-radius: 4px 0 0 4px;
}

.annotation-handle-right {
  right: 0;
  border-radius: 0 4px 4px 0;
}

.time-range-selector-container {
  padding: 0;
  background-color: #fff;
  border-radius: 4px;
}
</style>