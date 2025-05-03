<template>
  <div class="zoom-control">
    <!-- 缩小按钮 -->
    <n-button size="small" @click="zoomOut" title="缩小视图">
      <template #icon>
        <n-icon>
          <IconZoomOut />
        </n-icon>
      </template>
    </n-button>

    <!-- 缩放级别显示 -->
    <div class="zoom-level">{{ formattedZoomLevel }}</div>

    <!-- 放大按钮 -->
    <n-button size="small" @click="zoomIn" title="放大视图">
      <template #icon>
        <n-icon>
          <IconZoomIn />
        </n-icon>
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
  return `${pixelsPerSecond.value.toFixed(1)}%`
})

// 放大
const zoomIn = () => {
  // 更新视口状态
  domAnnotationStore.zoomInView()
}

// 缩小
const zoomOut = () => {
  // 更新视口状态
  domAnnotationStore.zoomOutView()
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
