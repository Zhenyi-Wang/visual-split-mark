<template>
  <div class="annotation-dom-container" ref="containerRef">
    <!-- 标注区域容器 -->
    <div 
      class="annotation-container" 
      :style="{
        width: `${totalWidth}px`,
        height: `${containerHeight}px`
      }"
    >
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import type { Annotation } from '~/types/project'

const props = defineProps({
  height: {
    type: Number,
    default: 200
  }
})

// 事件
const emit = defineEmits(['annotation-click', 'annotation-select'])

// DOM引用
const containerRef = ref<HTMLDivElement | null>(null)

// 使用DOM标注状态存储
const domAnnotationStore = useDOMAnnotationStore()

// 当前选中的标注ID
const selectedAnnotationId = ref<string | null>(null)

// 计算可见标注
const visibleAnnotations = computed(() => {
  return domAnnotationStore.visibleAnnotations
})

// 计算总宽度
const totalWidth = computed(() => {
  const { pixelsPerSecond } = domAnnotationStore.viewportState
  const audioFile = domAnnotationStore.currentAudioFile
  
  if (!audioFile || !audioFile.duration) return 1000
  
  return audioFile.duration * pixelsPerSecond
})

// 计算容器高度
const containerHeight = computed(() => {
  return props.height
})

// 获取标注样式
const getAnnotationStyle = (annotation: Annotation) => {
  const { startTime, pixelsPerSecond } = domAnnotationStore.viewportState
  
  // 计算标注的位置和宽度
  const left = (annotation.start - startTime) * pixelsPerSecond
  const width = (annotation.end - annotation.start) * pixelsPerSecond
  
  return {
    left: `${left}px`,
    width: `${width}px`,
    top: '8px',
    height: 'calc(100% - 16px)'
  }
}

// 处理标注点击
const handleAnnotationClick = (annotation: Annotation) => {
  selectedAnnotationId.value = annotation.id
  emit('annotation-click', annotation)
  emit('annotation-select', annotation.id)
  
  // 更新状态管理中的选中标注
  domAnnotationStore.selectAnnotation(annotation.id)
}

// 监听视图状态变化
watch(() => domAnnotationStore.viewportState, () => {
  // 当视口变化时可能需要更新标注位置
}, { deep: true })

// 监听选中标注变化
watch(() => domAnnotationStore.uiState.selectedAnnotationId, (newId) => {
  selectedAnnotationId.value = newId
})

// 生命周期钩子
onMounted(() => {
  // 初始化操作
})

onUnmounted(() => {
  // 清理操作
})

// 暴露方法给父组件
defineExpose({
  scrollToTime: (time: number) => {
    // 可以实现滚动到指定时间点的方法
  }
})
</script>

<style scoped>
.annotation-dom-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: #fafafa;
}

.annotation-container {
  position: relative;
  height: 100%;
  min-width: 100%;
}

.annotation-item {
  position: absolute;
  border-radius: 4px;
  background-color: rgba(64, 158, 255, 0.2);
  border: 1px solid #409eff;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  transition: background-color 0.2s;
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
  padding: 4px 8px;
  font-size: 12px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.annotation-handle {
  position: absolute;
  width: 6px;
  height: 100%;
  top: 0;
  cursor: ew-resize;
  background-color: #409eff;
}

.annotation-handle-left {
  left: 0;
  border-radius: 4px 0 0 4px;
}

.annotation-handle-right {
  right: 0;
  border-radius: 0 4px 4px 0;
}
</style>
