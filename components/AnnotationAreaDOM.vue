<template>
  <div class="annotation-area" ref="annotationAreaRef">
    <!-- 根据标注数据渲染标注项 -->
    <div v-for="annotation in visibleAnnotations" :key="annotation.id" class="annotation-item"
      :class="{ 'annotation-selected': annotation.id === domAnnotationStore.uiState.selectedAnnotationId }"
      :style="getAnnotationStyle(annotation)" @click="handleAnnotationClick(annotation)">
      <div class="annotation-content">{{ annotation.text || '(无文本)' }}</div>
      <div class="annotation-handle annotation-handle-left"></div>
      <div class="annotation-handle annotation-handle-right"></div>
    </div>

    <!-- 添加标注按钮 -->
    <div v-show="createButtonShow" class="annotation-add-button" :style="{ left: `${createButtonPositionPx}px` }"
      @click="handleAddAnnotationClick">
      <n-icon size="18">
        <IconAdd />
      </n-icon>
      <span>添加标注</span>
    </div>

    <!-- 预览标注项 -->
    <div v-if="createPreviewShow" class="annotation-item annotation-preview" :style="getPreviewAnnotationStyle()">
      <template v-if="isCreateAnnotationConfirming">
        <textarea ref="newAnnotationInputRef" v-model="tempAnnotationText" class="annotation-input"
          placeholder="Ctrl+回车保存, Esc取消" rows="3" @keyup.enter @keyup.enter.ctrl="confirmNewAnnotation"
          @keyup.esc="cancelNewAnnotation"></textarea>
        
        <!-- 编辑操作按钮 - 移到预览标注项内部 -->
        <div class="annotation-edit-actions">
          <n-button size="small" @click="cancelNewAnnotation">
            取消
          </n-button>
          <n-button size="small" type="primary" @click="confirmNewAnnotation">
            确认
          </n-button>
        </div>
      </template>
      <div v-else class="annotation-content annotation-preview-content">
        点击确认范围
      </div>
    </div>

    <!-- 编辑操作按钮 - 移除外部的按钮 -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { NIcon, NButton } from 'naive-ui'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { useProjectStore } from '~/stores/project'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { Add as IconAdd } from '@icon-park/vue-next'
import { useMouseInElement, watchThrottled, useMousePressed, useDebounceFn, useEventListener } from '@vueuse/core'

// Store
const domAnnotationStore = useDOMAnnotationStore()
const projectStore = useProjectStore()

// 将解构赋值改为计算属性
const viewStartTime = computed(() => domAnnotationStore.viewportState.startTime)
const viewEndTime = computed(() => domAnnotationStore.viewportState.endTime)

// 获取音频播放器实例
const audioPlayer = useAudioPlayer()
const currentPlayTime = computed(() => domAnnotationStore.playbackState.currentTime)

// 组件引用
const annotationAreaRef = ref<HTMLDivElement | null>(null)
const newAnnotationInputRef = ref<HTMLInputElement | null>(null)

// 状态机状态 - 使用 store 中的状态
const annotationState = computed(() => domAnnotationStore.uiState.annotationState)
const resizeDirection = ref<'left' | 'right' | null>(null)

// 本地状态
const tempAnnotationText = ref('')

// 预览标注数据
const createPreviewAnnotation = reactive({
  start: 0,
  end: 0,
  text: '',
  id: null as string | null
})

// 鼠标在容器内的位置
const { x: mouseX } = useMouseInElement()

// 全局鼠标按下状态
const { pressed } = useMousePressed()

// 计算属性：是否处于创建标注的拖拽阶段
const isCreatingStageDragging = computed(() => annotationState.value === 'creating_drag')

// 计算属性：是否处于创建标注的编辑阶段
const isCreateAnnotationConfirming = computed(() => annotationState.value === 'creating_edit')

// 计算属性：是否显示预览
const createPreviewShow = computed(() =>
  ['creating_drag', 'creating_edit', 'resizing'].includes(annotationState.value)
)

// 计算属性：创建按钮位置
const createButtonPositionPx = computed(() => {
  return timeToPixel(currentPlayTime.value)
})

// 判断是否显示添加标注按钮
const createButtonShow = computed(() => {
  // 当前是否为空闲状态
  if (annotationState.value !== 'idle') {
    return false
  }

  // 播放进度是否在当前视口范围内
  if (currentPlayTime.value < viewStartTime.value || currentPlayTime.value > viewEndTime.value) {
    return false
  }

  // 播放进度是否在标注上
  if (domAnnotationStore.hasAnnotationAt(currentPlayTime.value)) {
    return false
  }

  return true
})

// 获取可见标注
const visibleAnnotations = computed(() => {
  return domAnnotationStore.visibleAnnotations
})

// 获取容器宽度
const containerWidth = computed(() => {
  if (!annotationAreaRef.value) return 0
  return annotationAreaRef.value.clientWidth
})

// 获取容器距离窗口左边的像素位置
const containerX = computed(() => {
  if (!annotationAreaRef.value) return 0
  return annotationAreaRef.value.getBoundingClientRect().left
})

// 将时间转换为像素位置
const timeToPixel = (time: number) => {
  const viewDuration = viewEndTime.value - viewStartTime.value
  return ((time - viewStartTime.value) / viewDuration) * containerWidth.value
}

// 像素位置转时间
const getTimeFromPx = (px: number) => {
  if (!annotationAreaRef.value) return 0
  const time = viewStartTime.value + (px / containerWidth.value) * (viewEndTime.value - viewStartTime.value)
  return time
}

// 获取标注样式
const getAnnotationStyle = (annotation: any) => {
  const left = timeToPixel(annotation.start)
  const right = timeToPixel(Math.min(domAnnotationStore.audioDuration, annotation.end))
  const width = right - left
  return {
    left: `${left}px`,
    width: `${width}px`
  }
}

// 获取预览标注样式
const getPreviewAnnotationStyle = () => {
  const annotation = {
    ...createPreviewAnnotation
  }

  console.log('getPreviewAnnotationStyle init', annotation, createPreviewAnnotation)

  // 如果开始时间大于结束时间，交换它们
  if (annotation.start > annotation.end) {
    annotation.start = createPreviewAnnotation.end
    annotation.end = createPreviewAnnotation.start
  }

  // 如果开始时间等于结束时间，设置结束时间为0.1秒
  if (annotation.start === annotation.end) {
    annotation.end = annotation.end + 0.1
  }

  console.log('annotation', annotation, getAnnotationStyle(annotation))

  return getAnnotationStyle(annotation)
}

// 处理标注点击
const handleAnnotationClick = (annotation: any) => {
  if (domAnnotationStore.uiState.selectedAnnotationId === annotation.id) {
    // 如果点击的是当前选中的标注，取消选中
    domAnnotationStore.selectAnnotation(null)
  } else {
    // 选中新的标注并跳转到对应时间点
    domAnnotationStore.selectAnnotation(annotation.id)
    audioPlayer.seek(annotation.start)
  }
}

// 防抖的鼠标移动处理函数
const handleMouseMoveX = () => {
  if (!annotationAreaRef.value) return

  if (!['creating_drag', 'resizing'].includes(annotationState.value)) {
    return
  }

  // 根据当前状态处理鼠标移动
  if (annotationState.value === 'creating_drag') {
    updateDragging()
  } else if (annotationState.value === 'resizing') {
    updateResizing()
  }
}

// 更新拖拽中的标注
const updateDragging = () => {
  const relativeX = mouseX.value - containerX.value
  console.log('relativeX', relativeX, mouseX.value, containerX.value)

  // 计算时间点
  const time = getTimeFromPx(relativeX)

  // 获取拖拽的限制范围
  const minTime = Math.max(
    viewStartTime.value,
    domAnnotationStore.getPreviousAnnotationEndTime(createPreviewAnnotation.start)
  )

  const maxTime = Math.min(
    viewEndTime.value,
    domAnnotationStore.getNextAnnotationStartTime(createPreviewAnnotation.start)
  )

  // 限制结束时间在有效范围内
  createPreviewAnnotation.end = Math.min(Math.max(time, minTime), maxTime)

  console.log('拖拽范围限制', {
    time,
    minTime,
    maxTime,
    viewStart: viewStartTime.value,
    viewEnd: viewEndTime.value,
    prevEnd: domAnnotationStore.getPreviousAnnotationEndTime(createPreviewAnnotation.start),
    nextStart: domAnnotationStore.getNextAnnotationStartTime(createPreviewAnnotation.start)
  })
}

// 更新调整大小中的标注
const updateResizing = () => {
  // if (!resizeDirection.value) return

  // const relativeX = mouseX.value - containerWidth.value

  // // 计算时间点
  // const time = getTimeFromPx(relativeX)

  // if (resizeDirection.value === 'left') {
  //   // 调整左侧边界
  //   const minTime = domAnnotationStore.getPreviousAnnotationEndTime(createPreviewAnnotation.end)
  //   const maxTime = createPreviewAnnotation.end - 0.1 // 确保至少有0.1秒的间隔

  //   createPreviewAnnotation.start = Math.min(Math.max(time, minTime), maxTime)
  // } else {
  //   // 调整右侧边界
  //   const minTime = createPreviewAnnotation.start + 0.1 // 确保至少有0.1秒的间隔
  //   const maxTime = domAnnotationStore.getNextAnnotationStartTime(createPreviewAnnotation.start)

  //   createPreviewAnnotation.end = Math.min(Math.max(time, minTime), maxTime)
  // }
}

// 开始创建标注
const handleAddAnnotationClick = () => {
  domAnnotationStore.setAnnotationState('creating_drag')
  createPreviewAnnotation.text = ''
  createPreviewAnnotation.id = null
  createPreviewAnnotation.start = currentPlayTime.value
  createPreviewAnnotation.end = getTimeFromPx(mouseX.value)
}

// 开始调整标注大小
const startResizing = (annotation: any, direction: 'left' | 'right') => {
  domAnnotationStore.setAnnotationState('resizing')
  resizeDirection.value = direction
  createPreviewAnnotation.start = annotation.start
  createPreviewAnnotation.end = annotation.end
  createPreviewAnnotation.text = annotation.text
  createPreviewAnnotation.id = annotation.id
}

// 开始编辑标注文本
const startEditingText = (annotation: any) => {
  domAnnotationStore.setAnnotationState('editing_text')
  createPreviewAnnotation.start = annotation.start
  createPreviewAnnotation.end = annotation.end
  createPreviewAnnotation.text = annotation.text
  createPreviewAnnotation.id = annotation.id
  tempAnnotationText.value = annotation.text
}

// 确认新标注
const confirmNewAnnotation = () => {
  if (annotationState.value === 'creating_edit') {
    // 创建新标注
    domAnnotationStore.createAnnotation({
      start: createPreviewAnnotation.start,
      end: createPreviewAnnotation.end,
      text: tempAnnotationText.value
    })
  } else if (annotationState.value === 'editing_text' && createPreviewAnnotation.id) {
    // 更新现有标注
    domAnnotationStore.updateAnnotation(createPreviewAnnotation.id, {
      text: tempAnnotationText.value
    })
  }

  // 重置状态
  domAnnotationStore.setAnnotationState('idle')
  resizeDirection.value = null
  tempAnnotationText.value = ''
}

// 取消操作
const cancelNewAnnotation = () => {
  domAnnotationStore.setAnnotationState('idle')
  resizeDirection.value = null
  tempAnnotationText.value = ''
}

// 监听鼠标按下状态变化
watch(pressed, (isPressed) => {
  if (!isPressed) {
    // 鼠标释放
    if (annotationState.value === 'creating_drag') {
      // 从拖拽状态切换到编辑状态
      domAnnotationStore.setAnnotationState('creating_edit')

      // 聚焦输入框
      setTimeout(() => {
        if (newAnnotationInputRef.value) {
          newAnnotationInputRef.value.focus()
        }
      }, 50)
    } else if (annotationState.value === 'resizing') {
      // 完成调整大小，回到空闲状态
      domAnnotationStore.setAnnotationState('idle')
      resizeDirection.value = null

      // 更新标注大小
      if (createPreviewAnnotation.id) {
        domAnnotationStore.updateAnnotation(createPreviewAnnotation.id, {
          start: createPreviewAnnotation.start,
          end: createPreviewAnnotation.end
        })
      }
    }
  }
})

onMounted(() => {

  watchThrottled(mouseX, () => {
    handleMouseMoveX()
  }, { throttle: 50 })
  // // 设置全局事件监听
  // useEventListener(window, 'mousemove', handleMouseMove)

  // // 监听全局点击事件，用于处理点击外部取消操作
  // useEventListener(window, 'click', (event) => {
  //   if (
  //     annotationAreaRef.value && 
  //     !annotationAreaRef.value.contains(event.target as Node) && 
  //     ['creating_edit', 'editing_text'].includes(annotationState.value)
  //   ) {
  //     cancelNewAnnotation()
  //   }
  // })
})

// 组件卸载时清理事件监听
onUnmounted(() => {
  // 事件监听会自动清理，不需要手动移除
})
</script>

<style scoped>
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
  height: 80px;
  background-color: rgba(64, 158, 255, 0.2);
  border: 1px solid #409eff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
  pointer-events: all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: start;
  padding: 6px 6px;
}

.annotation-item:hover {
  background-color: rgba(64, 158, 255, 0.3);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.annotation-selected {
  background-color: rgba(64, 158, 255, 0.4);
  border: 1px solid #2c8af8;
  box-shadow: 0 2px 8px rgba(44, 138, 248, 0.4);
  z-index: 10;
}

.annotation-selected .annotation-content {
  font-weight: bold;
  color: #1056b7;
}

.annotation-selected .annotation-handle {
  background-color: #2c8af8;
}

.annotation-content {
  font-size: calc(11px + v-bind('Math.min(1, domAnnotationStore.viewportState.pixelsPerSecond / 50)') * 3px);
  width: 100%;
  max-height: 70px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  line-height: 1.3;
  text-overflow: ellipsis;
  text-align: left;
  padding: 4px 0;
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

.annotation-add-button {
  position: absolute;
  top: 0;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  background-color: #409eff;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  pointer-events: all;
}

.annotation-preview {
  background-color: rgba(255, 255, 0, 0.2);
  border: 1px solid #ffff00;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow: visible !important; /* 覆盖默认的overflow: hidden，允许按钮显示在外部 */
}

.annotation-preview-content {
  font-size: 12px;
  color: #666;
  padding: 4px 0;
}

.annotation-input {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  resize: none;
}

.annotation-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.annotation-edit-actions {
  pointer-events: auto;
  position: absolute;
  bottom: -40px; /* 位于标注项下方 */
  right: 0; /* 靠右对齐 */
  width: auto; /* 宽度自适应内容 */
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0;
  z-index: 11; /* 确保显示在最上层 */
}
</style>
