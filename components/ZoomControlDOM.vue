<template>
  <div class="zoom-control">
    <!-- 缩小按钮 -->
    <n-button size="small" @click="zoomOut" title="缩小视图">
      <template #icon>
        <n-icon><IconZoomOut /></n-icon>
      </template>
    </n-button>
    
    <!-- 缩放级别显示 -->
    <div class="zoom-level">{{ formattedZoomLevel }}</div>
    
    <!-- 放大按钮 -->
    <n-button size="small" @click="zoomIn" title="放大视图">
      <template #icon>
        <n-icon><IconZoomIn /></n-icon>
      </template>
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { ZoomIn as IconZoomIn, ZoomOut as IconZoomOut } from '@icon-park/vue-next'

// 使用DOM标注状态存储
const domAnnotationStore = useDOMAnnotationStore()

// 当前缩放级别
const pixelsPerSecond = computed(() => domAnnotationStore.viewportState.pixelsPerSecond)

// 格式化缩放级别显示
const formattedZoomLevel = computed(() => {
  return `${pixelsPerSecond.value.toFixed(0)}px/秒`
})

// 放大
const zoomIn = () => {
  // 获取当前视口状态
  const { startTime, endTime, pixelsPerSecond } = domAnnotationStore.viewportState
  
  // 计算视口中心时间点
  const centerTime = (startTime + endTime) / 2
  
  // 计算新的缩放级别 (增加50%)
  const newPixelsPerSecond = Math.min(pixelsPerSecond * 1.5, 1000)
  
  // 维持中心点不变，计算新的开始和结束时间
  const duration = (endTime - startTime)
  const newDuration = duration * (pixelsPerSecond / newPixelsPerSecond)
  const newStartTime = centerTime - newDuration / 2
  const newEndTime = centerTime + newDuration / 2
  
  // 更新视口状态
  domAnnotationStore.setViewport(Math.max(0, newStartTime), newEndTime)
  domAnnotationStore.setZoomLevel(newPixelsPerSecond)
}

// 缩小
const zoomOut = () => {
  // 获取当前视口状态
  const { startTime, endTime, pixelsPerSecond } = domAnnotationStore.viewportState
  
  // 计算视口中心时间点
  const centerTime = (startTime + endTime) / 2
  
  // 计算新的缩放级别 (减少33%)
  const newPixelsPerSecond = Math.max(pixelsPerSecond / 1.5, 10)
  
  // 维持中心点不变，计算新的开始和结束时间
  const duration = (endTime - startTime)
  const newDuration = duration * (pixelsPerSecond / newPixelsPerSecond)
  const newStartTime = centerTime - newDuration / 2
  const newEndTime = centerTime + newDuration / 2
  
  // 更新视口状态
  domAnnotationStore.setViewport(Math.max(0, newStartTime), newEndTime)
  domAnnotationStore.setZoomLevel(newPixelsPerSecond)
}
</script>

<style scoped>
.zoom-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-level {
  min-width: 70px;
  text-align: center;
  font-size: 14px;
  color: #666;
}
</style>
