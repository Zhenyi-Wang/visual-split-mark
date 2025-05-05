<template>
  <div class="annotation-area" ref="annotationAreaRef">
    <!-- 根据标注数据渲染标注项 -->
    <div v-for="annotation in visibleAnnotations" :key="annotation.id" class="annotation-item"
      :class="{ 'annotation-selected': annotation.id === domAnnotationStore.uiState.selectedAnnotationId }"
      :style="getAnnotationStyle(annotation)" @click="handleAnnotationClick(annotation)">
      <!-- 当标注不在编辑状态时显示内容 -->
      <div class="annotation-content" v-if="annotation.id !== domAnnotationStore.uiState.editingAnnotationId">
        {{ annotation.text || '(无文本)' }}
      </div>

      <!-- 编辑状态 -->
      <div v-else class="annotation-content annotation-preview-content">
        正在编辑...
      </div>

      <!-- 操作按钮区域 -->
      <div class="annotation-buttons" v-if="annotation.id !== domAnnotationStore.uiState.editingAnnotationId">
        <div class="annotation-buttons-row">
          <button class="annotation-btn edit-btn" @click.stop="handleEditClick(annotation)" title="编辑">
            <n-icon size="16">
              <Edit />
            </n-icon>
          </button>
          <button class="annotation-btn more-btn" @click.stop="showAnnotationMenu(annotation, $event)" title="更多操作">
            <n-icon size="16">
              <More />
            </n-icon>
          </button>
        </div>
      </div>

      <!-- 左侧操作杆 -->
      <div class="annotation-handle-container annotation-handle-container-left">
        <!-- 上段：联动操作杆 -->
        <div class="annotation-handle-section annotation-handle-top-section">
          <div class="annotation-handle annotation-handle-top annotation-handle-left"
            v-if="hasPreviousAnnotation(annotation)" @mousedown="handleResizeStart(annotation, 'left', true, $event)"
            title="同时调整两个标注"></div>
        </div>

        <!-- 中间空白区域 -->
        <div class="annotation-handle-section annotation-handle-middle-section"></div>

        <!-- 下段：独立操作杆 -->
        <div class="annotation-handle-section annotation-handle-bottom-section">
          <div class="annotation-handle annotation-handle-bottom annotation-handle-left"
            @mousedown="handleResizeStart(annotation, 'left', false, $event)" title="调整标注边界"></div>
        </div>
      </div>

      <!-- 右侧操作杆 -->
      <div class="annotation-handle-container annotation-handle-container-right">
        <!-- 上段：联动操作杆 -->
        <div class="annotation-handle-section annotation-handle-top-section">
          <div class="annotation-handle annotation-handle-top annotation-handle-right"
            v-if="hasNextAnnotation(annotation)" @mousedown="handleResizeStart(annotation, 'right', true, $event)"
            title="同时调整两个标注"></div>
        </div>

        <!-- 中间空白区域 -->
        <div class="annotation-handle-section annotation-handle-middle-section"></div>

        <!-- 下段：独立操作杆 -->
        <div class="annotation-handle-section annotation-handle-bottom-section">
          <div class="annotation-handle annotation-handle-bottom annotation-handle-right"
            @mousedown="handleResizeStart(annotation, 'right', false, $event)" title="调整标注边界"></div>
        </div>
      </div>
    </div>

    <!-- 添加标注按钮 -->
    <div v-show="createButtonShow" class="annotation-add-button" :style="{ left: `${createButtonPositionPx}px` }"
      @click="handleAddAnnotationClick('normal')">
      <n-icon size="18">
        <IconAdd />
      </n-icon>
      <span>添加标注</span>
    </div>

    <!-- 预览标注项 -->
    <div v-if="createPreviewShow" class="annotation-item annotation-preview" :style="getPreviewAnnotationStyle()">
      <div class="annotation-content annotation-preview-content" v-show="annotationState === 'creating_drag'">
        点击确认范围
      </div>
    </div>

    <!-- 分割标注模态框 -->
    <n-modal v-model:show="showSplitModal" preset="card" title="分割标注" style="width: 400px">
      <p>请点击要分割的位置：</p>
      <div class="split-preview">
        <div class="split-text-container">
          <span v-for="(char, index) in splitText" :key="index" class="split-char" :class="{
            'split-first-part': index < splitPosition,
            'split-second-part': index >= splitPosition,
            'split-position': index === splitPosition - 1,
            'hover-split': previewSplitPosition !== null && index === previewSplitPosition - 1
          }" @click="splitPosition = index + 1" @mouseover="previewSplitPosition = index + 1"
            @mouseleave="previewSplitPosition = null">{{ char }}</span>
        </div>
      </div>
      <div class="split-actions">
        <n-button @click="cancelSplit">取消</n-button>
        <n-button type="primary" @click="confirmSplit">确认分割</n-button>
      </div>
    </n-modal>

    <!-- 标注编辑模态框 -->
    <n-modal v-model:show="showAnnotationModal" preset="card" :title="isEditingExisting ? '编辑标注' : '创建标注'"
      style="width: 450px">
      <div class="modal-content">
        <!-- 时间范围编辑 -->
        <div class="time-range-editor">
          <div class="time-editor-label">开始时间:</div>
          <n-input-number v-model:value="modalAnnotation.start" :min="minStartTime" :max="maxStartTime" :step="0.1"
            size="small" />

          <div class="time-editor-label">结束时间:</div>
          <n-input-number v-model:value="modalAnnotation.end" :min="minEndTime" :max="maxEndTime" :step="0.1"
            size="small" />
        </div>

        <!-- 文本编辑区 -->
        <textarea v-model="modalAnnotation.text" class="modal-annotation-input" placeholder="请输入标注内容" rows="5"
          @keyup.enter.ctrl="confirmAnnotation" @keyup.esc="cancelAnnotation"></textarea>

        <div class="modal-actions">
          <n-button @click="cancelAnnotation">取消</n-button>
          <n-button type="primary" @click="confirmAnnotation">确认 (Ctrl+Enter)</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 标注操作菜单 -->
    <n-dropdown :show="showDropdown" :options="dropdownOptions" :x="dropdownX" :y="dropdownY" placement="bottom-start"
      @select="handleDropdownSelect" @clickoutside="hideAnnotationMenu" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, h } from 'vue'
import { NIcon, NButton, useDialog, NModal, NInput, NCheckbox, NInputNumber } from 'naive-ui'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { useProjectStore } from '~/stores/project'
import { Add as IconAdd, Edit, Delete, MergeCells, Split, More } from '@icon-park/vue-next'
import { useMouseInElement, watchThrottled, useMousePressed, useDebounceFn, useEventListener, useElementSize, useElementBounding } from '@vueuse/core'
import type { AudioPlayer } from '~/types/audio'

// 定义组件属性
const props = defineProps<{
  audioPlayer: AudioPlayer
}>()

// Store
const domAnnotationStore = useDOMAnnotationStore()
const projectStore = useProjectStore()

// 将解构赋值改为计算属性
const viewStartTime = computed(() => domAnnotationStore.viewportState.startTime)
const viewEndTime = computed(() => domAnnotationStore.viewportState.endTime)

// 获取音频播放器实例
const currentPlayTime = computed(() => domAnnotationStore.playbackState.currentTime)

// 组件引用
const annotationAreaRef = ref<HTMLDivElement | null>(null)
const newAnnotationInputRef = ref<HTMLTextAreaElement | null>(null)
const editAnnotationInputRef = ref<HTMLTextAreaElement | null>(null)

// 使用 useElementSize 监听容器尺寸
const { width: containerWidth } = useElementSize(annotationAreaRef)

// 使用 useElementBounding 获取容器位置
const { left: containerX } = useElementBounding(annotationAreaRef)

// 状态机状态 - 使用 store 中的状态
const annotationState = computed(() => domAnnotationStore.uiState.annotationState)
const resizeDirection = ref<'left' | 'right' | null>(null)

// Naive UI 对话框
const dialog = useDialog()

// 本地状态
const tempAnnotationText = ref('')
const splitText = ref('')
const splitPosition = ref(0)
const showSplitModal = ref(false)
const currentSplitAnnotation = ref<any>(null)
const previewSplitPosition = ref<number | null>(null)

// 预览标注数据
const createPreviewAnnotation = reactive({
  start: 0,
  end: 0,
  text: '',
  id: null as string | null
})

// 添加方向类型定义
type AddDirection = 'normal' | 'from_left' | 'from_right'

// 状态变量
const addDirection = ref<AddDirection>('normal')
const selectedOrHoveredAnnotation = ref<any>(null)
const isLinkedResize = ref(false)
const linkedAnnotation = ref<any>(null)

// 模态框控制
const showAnnotationModal = ref(false)
const isEditingExisting = ref(false)

// 模态框中的标注数据
const modalAnnotation = reactive({
  id: null as string | null,
  start: 0,
  end: 0,
  text: ''
})

// 时间范围限制计算属性
const minStartTime = computed(() => {
  // 获取前一个标注的结束时间，或者视图起始时间
  const prevAnnotationEnd = modalAnnotation.id
    ? domAnnotationStore.getPreviousAnnotationEndTime(Number(modalAnnotation.id))
    : domAnnotationStore.getPreviousAnnotationEndTime(modalAnnotation.end)
  return Math.max(0, prevAnnotationEnd || 0)
})

const maxStartTime = computed(() => {
  // 最大开始时间不能超过结束时间减去最小间隔
  return Math.max(0, modalAnnotation.end - 0.1)
})

const minEndTime = computed(() => {
  // 最小结束时间不能小于开始时间加上最小间隔
  return Math.max(0, modalAnnotation.start + 0.1)
})

const maxEndTime = computed(() => {
  // 获取下一个标注的开始时间，或者音频总时长
  const nextAnnotationStart = modalAnnotation.id
    ? domAnnotationStore.getNextAnnotationStartTime(Number(modalAnnotation.id))
    : domAnnotationStore.getNextAnnotationStartTime(modalAnnotation.start)

  const audioDuration = domAnnotationStore.audioDuration
  return Math.min(audioDuration, nextAnnotationStart || audioDuration)
})

// 鼠标在容器内的位置
const { x: mouseX } = useMouseInElement()

// 全局鼠标按下状态
const { pressed } = useMousePressed()

// 本地鼠标按下状态
const isMouseDown = ref(false)

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

  // 如果开始时间大于结束时间，交换它们
  if (annotation.start > annotation.end) {
    annotation.start = createPreviewAnnotation.end
    annotation.end = createPreviewAnnotation.start
  }

  // 如果开始时间等于结束时间，增加0.1秒
  if (annotation.start === annotation.end) {
    annotation.end = annotation.end + 0.1
  }

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
    props.audioPlayer.seek(annotation.start)
  }
}

// 更新拖拽中的标注
const updateDragging = () => {
  const relativeX = mouseX.value - containerX.value
  console.log('relativeX', relativeX, mouseX.value, containerX.value)

  // 计算时间点
  const time = getTimeFromPx(relativeX)

  let minTime, maxTime
  const prevAnnotationEnd = domAnnotationStore.getPreviousAnnotationEndTime(createPreviewAnnotation.end)
  const nextAnnotationStart = domAnnotationStore.getNextAnnotationStartTime(createPreviewAnnotation.start)

  // 根据不同的添加方向设置不同的边界限制
  switch (addDirection.value) {
    case 'from_left':
      // 从左边添加：最大时间是当前标注的起始时间
      minTime = Math.max(
        viewStartTime.value,
        prevAnnotationEnd
      )
      // 使用特定标注的起始时间作为最大边界
      maxTime = Math.min(
        viewEndTime.value,
        selectedOrHoveredAnnotation.value?.start || nextAnnotationStart
      ) - 0.1
      break

    case 'from_right':
      // 从右边添加：最小时间是当前标注的结束时间
      minTime = Math.max(
        viewStartTime.value,
        selectedOrHoveredAnnotation.value?.end || prevAnnotationEnd
      ) + 0.1
      maxTime = Math.min(
        viewEndTime.value,
        nextAnnotationStart
      )
      break

    case 'normal':
    default:
      // 在空白区域添加（保持现有逻辑）
      minTime = Math.max(
        viewStartTime.value,
        prevAnnotationEnd
      )
      maxTime = Math.min(
        viewEndTime.value,
        nextAnnotationStart
      )
      break
  }

  // 限制结束时间在有效范围内
  createPreviewAnnotation.end = Math.min(Math.max(time, minTime), maxTime)

  console.log('拖拽范围限制', {
    time,
    minTime,
    maxTime,
    viewStart: viewStartTime.value,
    viewEnd: viewEndTime.value,
    prevEnd: domAnnotationStore.getPreviousAnnotationEndTime(createPreviewAnnotation.start),
    nextStart: domAnnotationStore.getNextAnnotationStartTime(createPreviewAnnotation.start),
    direction: addDirection.value
  })
}

// 更新调整大小中的标注
const updateResizing = () => {
  if (annotationState.value !== 'resizing' || !selectedOrHoveredAnnotation.value) return

  const relativeX = mouseX.value - containerX.value
  const time = getTimeFromPx(relativeX)
  const direction = resizeDirection.value

  if (!direction) return

  // 获取相邻标注的边界限制
  const prevAnnotationEnd = domAnnotationStore.getPreviousAnnotationEndTime(createPreviewAnnotation.id as any)
  const nextAnnotationStart = domAnnotationStore.getNextAnnotationStartTime(createPreviewAnnotation.id as any)

  // 根据方向和是否联动更新标注
  if (direction === 'left') {
    // 左侧调整，更新开始时间
    const minTime = Math.max(0, prevAnnotationEnd)
    const maxTime = Math.min(createPreviewAnnotation.end - 0.1, viewEndTime.value)

    // 限制在有效范围内
    const newStart = Math.max(minTime, Math.min(maxTime, time))
    createPreviewAnnotation.start = newStart

    // 如果是联动操作且有相邻标注
    if (isLinkedResize.value && linkedAnnotation.value) {
      // 更新相邻标注的结束时间
      domAnnotationStore.updateAnnotation(linkedAnnotation.value.id, {
        end: newStart
      })
    }
  } else {
    // 右侧调整，更新结束时间
    const minTime = Math.max(createPreviewAnnotation.start + 0.1, viewStartTime.value)
    const maxTime = Math.min(nextAnnotationStart, domAnnotationStore.audioDuration)

    // 限制在有效范围内
    const newEnd = Math.max(minTime, Math.min(maxTime, time))
    createPreviewAnnotation.end = newEnd

    // 如果是联动操作且有相邻标注
    if (isLinkedResize.value && linkedAnnotation.value) {
      // 更新相邻标注的开始时间
      domAnnotationStore.updateAnnotation(linkedAnnotation.value.id, {
        start: newEnd
      })
    }
  }
}

// 开始创建标注
const handleAddAnnotationClick = (direction: AddDirection = 'normal') => {
  domAnnotationStore.setAnnotationState('creating_drag')
  createPreviewAnnotation.text = ''
  createPreviewAnnotation.id = null
  createPreviewAnnotation.start = currentPlayTime.value
  createPreviewAnnotation.end = getTimeFromPx(mouseX.value)
  addDirection.value = direction // 保存添加方向
}

// 处理开始调整大小
const handleResizeStart = (annotation: any, direction: 'left' | 'right', isLinked: boolean = false, event: MouseEvent) => {
  // 阻止事件冒泡，避免触发标注点击事件
  event.stopPropagation();
  
  // 设置本地鼠标按下状态
  isMouseDown.value = true;
  
  // 调用原来的调整大小函数
  startResizing(annotation, direction, isLinked);
  
  // 添加全局鼠标抬起事件监听
  const handleMouseUp = () => {
    isMouseDown.value = false;
    
    // 完成调整大小，回到空闲状态
    if (annotationState.value === 'resizing') {
      domAnnotationStore.setAnnotationState('idle');
      domAnnotationStore.setResizing(false, null);
      resizeDirection.value = null;

      // 更新标注大小
      if (createPreviewAnnotation.id) {
        domAnnotationStore.updateAnnotation(createPreviewAnnotation.id, {
          start: createPreviewAnnotation.start,
          end: createPreviewAnnotation.end
        });
      }
    }
    
    // 移除事件监听
    window.removeEventListener('mouseup', handleMouseUp);
  };
  
  // 添加一次性事件监听
  window.addEventListener('mouseup', handleMouseUp, { once: true });
}

// 开始调整标注大小
const startResizing = (annotation: any, direction: 'left' | 'right', isLinked: boolean = false) => {
  domAnnotationStore.setAnnotationState('resizing')
  domAnnotationStore.setResizing(true, direction)
  resizeDirection.value = direction

  // 保存当前操作的标注
  selectedOrHoveredAnnotation.value = annotation

  // 设置预览标注数据
  createPreviewAnnotation.start = annotation.start
  createPreviewAnnotation.end = annotation.end
  createPreviewAnnotation.text = annotation.text
  createPreviewAnnotation.id = annotation.id

  // 保存是否为联动操作
  isLinkedResize.value = isLinked

  // 如果是联动操作，保存相邻标注
  if (isLinked) {
    if (direction === 'left') {
      linkedAnnotation.value = getPreviousAnnotation(annotation)
    } else {
      linkedAnnotation.value = getNextAnnotation(annotation)
    }
  } else {
    linkedAnnotation.value = null
  }
}

// 开始编辑标注文本
const startEditingText = (annotation: any) => {
  domAnnotationStore.setAnnotationState('editing_text')
  createPreviewAnnotation.start = annotation.start
  createPreviewAnnotation.end = annotation.end
  createPreviewAnnotation.text = annotation.text
  createPreviewAnnotation.id = annotation.id

  // 设置模态框数据
  modalAnnotation.id = annotation.id
  modalAnnotation.start = Math.min(annotation.start, annotation.end)
  modalAnnotation.end = Math.max(annotation.start, annotation.end)
  modalAnnotation.text = annotation.text || ''

  // 标记为编辑现有标注
  isEditingExisting.value = true

  // 显示模态框
  showAnnotationModal.value = true

  // 延迟聚焦输入框
  setTimeout(() => {
    const textarea = document.querySelector('.modal-annotation-input')
    if (textarea) {
      try {
        (textarea as HTMLTextAreaElement).focus()
      } catch (error) {
        console.error('无法聚焦编辑输入框:', error)
      }
    }
  }, 100)
}

// 确认新标注
const confirmNewAnnotation = () => {
  confirmAnnotation()
}

// 取消操作
const cancelNewAnnotation = () => {
  cancelAnnotation()
}

// 处理编辑按钮点击
const handleEditClick = (annotation: any) => {
  // 设置编辑状态
  domAnnotationStore.setAnnotationState('editing_text')
  domAnnotationStore.uiState.editingAnnotationId = annotation.id

  // 设置模态框数据
  modalAnnotation.id = annotation.id
  modalAnnotation.start = Math.min(annotation.start, annotation.end)
  modalAnnotation.end = Math.max(annotation.start, annotation.end)
  modalAnnotation.text = annotation.text || ''

  // 标记为编辑现有标注
  isEditingExisting.value = true

  // 显示模态框
  showAnnotationModal.value = true

  // 延迟聚焦输入框
  setTimeout(() => {
    const textarea = document.querySelector('.modal-annotation-input')
    if (textarea) {
      try {
        (textarea as HTMLTextAreaElement).focus()
      } catch (error) {
        console.error('无法聚焦编辑输入框:', error)
      }
    }
  }, 100)
}

// 确认编辑
const confirmEditAnnotation = () => {
  confirmAnnotation()
}

// 取消编辑
const cancelEditAnnotation = () => {
  cancelAnnotation()
}

// 确认标注（新建或编辑）
const confirmAnnotation = () => {
  if (isEditingExisting.value && modalAnnotation.id) {
    // 更新现有标注
    domAnnotationStore.updateAnnotation(modalAnnotation.id, {
      start: modalAnnotation.start,
      end: modalAnnotation.end,
      text: modalAnnotation.text
    })
  } else if (annotationState.value === 'creating_edit') {
    // 创建新标注
    domAnnotationStore.createAnnotation({
      start: modalAnnotation.start,
      end: modalAnnotation.end,
      text: modalAnnotation.text
    })
  }

  // 重置状态
  domAnnotationStore.setAnnotationState('idle')
  domAnnotationStore.uiState.editingAnnotationId = null
  resizeDirection.value = null

  // 关闭模态框
  showAnnotationModal.value = false
}

// 取消操作
const cancelAnnotation = () => {
  domAnnotationStore.setAnnotationState('idle')
  domAnnotationStore.uiState.editingAnnotationId = null
  resizeDirection.value = null

  // 关闭模态框
  showAnnotationModal.value = false
}

// 监听鼠标按下状态变化
watch(pressed, (isPressed) => {
  console.log(isPressed, domAnnotationStore.annotationState)
  if (!isPressed) {
    // 鼠标释放
    if (annotationState.value === 'creating_drag') {
      // 从拖拽状态切换到编辑状态
      domAnnotationStore.setAnnotationState('creating_edit')

      // 设置模态框数据
      modalAnnotation.id = null
      modalAnnotation.start = Math.min(createPreviewAnnotation.start, createPreviewAnnotation.end)
      modalAnnotation.end = Math.max(createPreviewAnnotation.start, createPreviewAnnotation.end)
      modalAnnotation.text = ''

      // 标记为创建新标注
      isEditingExisting.value = false

      // 显示模态框
      showAnnotationModal.value = true

      // 聚焦输入框
      setTimeout(() => {
        const textarea = document.querySelector('.modal-annotation-input')
        if (textarea) {
          (textarea as HTMLTextAreaElement).focus()
        }
      }, 50)
    } else if (annotationState.value === 'resizing') {
      // 完成调整大小，回到空闲状态
      domAnnotationStore.setAnnotationState('idle')
      domAnnotationStore.setResizing(false, null)
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

// 监听鼠标移动
watch(mouseX, () => {
  // 如果处于调整大小状态，则更新标注大小
  if (annotationState.value === 'resizing' && isMouseDown.value) {
    updateResizing();
  }
}, { immediate: false });

onMounted(() => {
  watchThrottled(mouseX, () => {
    if (!annotationAreaRef.value) return;

    // 根据当前状态处理鼠标移动
    if (annotationState.value === 'creating_drag') {
      updateDragging();
    } else if (annotationState.value === 'resizing' && isMouseDown.value) {
      updateResizing();
    }
  }, { throttle: 50 });
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  // 事件监听会自动清理，不需要手动移除
})

// 标注菜单相关状态
const showDropdown = ref(false)
const dropdownX = ref(0)
const dropdownY = ref(0)
const currentMenuAnnotation = ref<any>(null)
const dropdownOptions = computed(() => {
  const annotation = currentMenuAnnotation.value
  if (!annotation) return []

  // 检查标注左右是否有相邻标注
  const hasLeftAdjacent = hasPreviousAnnotation(annotation)
  const hasRightAdjacent = hasNextAnnotation(annotation)

  return [
    {
      label: '删除',
      key: 'delete',
      icon: () => h(Delete)
    },
    {
      label: '合并到左边',
      key: 'merge_left',
      icon: () => h(MergeCells),
      disabled: !hasLeftAdjacent
    },
    {
      label: '合并到右边',
      key: 'merge_right',
      icon: () => h(MergeCells, { style: { transform: 'rotate(180deg)' } }),
      disabled: !hasRightAdjacent
    },
    {
      label: '分割标注',
      key: 'split',
      icon: () => h(Split)
    },
    {
      type: 'divider'
    },
    {
      label: '添加到左边',
      key: 'add_left',
      icon: () => h('div', { style: { transform: 'scale(-1, 1)' } }, [h(IconAdd)]),
      disabled: hasLeftAdjacent
    },
    {
      label: '添加到右边',
      key: 'add_right',
      icon: () => h(IconAdd),
      disabled: hasRightAdjacent
    }
  ]
})

// 显示标注菜单
const showAnnotationMenu = (annotation: any, event: MouseEvent) => {
  showDropdown.value = true
  dropdownX.value = event.clientX
  dropdownY.value = event.clientY
  currentMenuAnnotation.value = annotation
}

// 隐藏标注菜单
const hideAnnotationMenu = () => {
  showDropdown.value = false
  currentMenuAnnotation.value = null
}

// 处理菜单选项点击
const handleDropdownSelect = (key: string) => {
  const annotation = currentMenuAnnotation.value
  if (!annotation) return

  switch (key) {
    case 'delete':
      handleDeleteClick(annotation)
      break
    case 'merge_left':
      handleMergeLeft(annotation)
      break
    case 'merge_right':
      handleMergeRight(annotation)
      break
    case 'split':
      handleSplitAnnotation(annotation)
      break
    case 'add_left':
      handleAddToLeft(annotation)
      break
    case 'add_right':
      handleAddToRight(annotation)
      break
  }

  // 选择后隐藏菜单
  hideAnnotationMenu()
}

// 检查是否有左侧相邻标注
const hasPreviousAnnotation = (annotation: any) => {
  const annotations = domAnnotationStore.currentAnnotations
  return annotations.some(a => a.end === annotation.start)
}

// 检查是否有右侧相邻标注
const hasNextAnnotation = (annotation: any) => {
  const annotations = domAnnotationStore.currentAnnotations
  return annotations.some(a => a.start === annotation.end)
}

// 获取左侧相邻标注
const getPreviousAnnotation = (annotation: any) => {
  const annotations = domAnnotationStore.currentAnnotations
  return annotations.find(a => a.end === annotation.start)
}

// 获取右侧相邻标注
const getNextAnnotation = (annotation: any) => {
  const annotations = domAnnotationStore.currentAnnotations
  return annotations.find(a => a.start === annotation.end)
}

// 处理合并到左边
const handleMergeLeft = (annotation: any) => {
  const prevAnnotation = getPreviousAnnotation(annotation)
  if (!prevAnnotation) return

  const mergeWithSeparator = ref(false)
  const separator = ref('')

  dialog.warning({
    title: '确认合并',
    content: () => {
      return h('div', [
        h('p', '确定要将此标注与左侧标注合并吗？'),
        h(NCheckbox, {
          checked: mergeWithSeparator.value,
          'onUpdate:checked': (val: boolean) => mergeWithSeparator.value = val
        }, { default: () => '使用字符连接' }),
        mergeWithSeparator.value && h(NInput, {
          value: separator.value,
          'onUpdate:value': (val: string) => separator.value = val,
          placeholder: '请输入连接字符',
          style: { marginTop: '8px' }
        })
      ])
    },
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      // 合并标注
      const mergedAnnotation = {
        ...prevAnnotation,
        end: annotation.end,
        text: `${prevAnnotation.text || ''}${mergeWithSeparator.value ? separator.value : ''}${annotation.text || ''}`
      }

      // 更新左侧标注
      domAnnotationStore.updateAnnotation(prevAnnotation.id, {
        end: annotation.end,
        text: mergedAnnotation.text
      })

      // 删除当前标注
      domAnnotationStore.deleteAnnotation(annotation.id)
    }
  })
}

// 处理合并到右边
const handleMergeRight = (annotation: any) => {
  const nextAnnotation = getNextAnnotation(annotation)
  if (!nextAnnotation) return

  const mergeWithSeparator = ref(false)
  const separator = ref('')

  dialog.warning({
    title: '确认合并',
    content: () => {
      return h('div', [
        h('p', '确定要将此标注与右侧标注合并吗？'),
        h(NCheckbox, {
          checked: mergeWithSeparator.value,
          'onUpdate:checked': (val: boolean) => mergeWithSeparator.value = val
        }, { default: () => '使用字符连接' }),
        mergeWithSeparator.value && h(NInput, {
          value: separator.value,
          'onUpdate:value': (val: string) => separator.value = val,
          placeholder: '请输入连接字符',
          style: { marginTop: '8px' }
        })
      ])
    },
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      // 合并标注
      const mergedAnnotation = {
        ...annotation,
        end: nextAnnotation.end,
        text: `${annotation.text || ''}${mergeWithSeparator.value ? separator.value : ''}${nextAnnotation.text || ''}`
      }

      // 更新当前标注
      domAnnotationStore.updateAnnotation(annotation.id, {
        end: nextAnnotation.end,
        text: mergedAnnotation.text
      })

      // 删除右侧标注
      domAnnotationStore.deleteAnnotation(nextAnnotation.id)
    }
  })
}

// 处理分割标注
const handleSplitAnnotation = (annotation: any) => {
  // 设置当前要分割的标注
  currentSplitAnnotation.value = annotation

  // 设置初始值
  splitText.value = annotation.text || ''
  splitPosition.value = 0 // 初始不选中任何位置
  previewSplitPosition.value = null

  // 显示分割模态框
  showSplitModal.value = true
}

// 确认分割
const confirmSplit = () => {
  const annotation = currentSplitAnnotation.value
  if (!annotation || splitPosition.value === 0) return

  // 分割成两个标注
  const firstPart = splitText.value.substring(0, splitPosition.value)
  const secondPart = splitText.value.substring(splitPosition.value)

  // 计算分割时间点
  const timeDuration = annotation.end - annotation.start
  const splitRatio = splitPosition.value / splitText.value.length
  const splitTime = annotation.start + (timeDuration * splitRatio)

  // 更新原标注
  domAnnotationStore.updateAnnotation(annotation.id, {
    end: splitTime,
    text: firstPart
  })

  // 创建新标注
  domAnnotationStore.createAnnotation({
    start: splitTime,
    end: annotation.end,
    text: secondPart
  })

  // 关闭模态框
  showSplitModal.value = false
}

// 取消分割
const cancelSplit = () => {
  showSplitModal.value = false
  currentSplitAnnotation.value = null
  splitPosition.value = 0
  previewSplitPosition.value = null
}

// 在标注左边添加新标注
const handleAddToLeft = (annotation: any) => {
  if (!annotation) return

  // 保存当前操作的标注
  selectedOrHoveredAnnotation.value = annotation
  domAnnotationStore.setCurrentTime(annotation.start)
  handleAddAnnotationClick('from_left')
}

// 在标注右边添加新标注
const handleAddToRight = (annotation: any) => {
  if (!annotation) return

  // 保存当前操作的标注
  selectedOrHoveredAnnotation.value = annotation
  domAnnotationStore.setCurrentTime(annotation.end)
  handleAddAnnotationClick('from_right')
}

// 处理删除按钮点击
const handleDeleteClick = (annotation: any) => {
  dialog.warning({
    title: '确认删除',
    content: () => {
      return h('div', [
        h('p', '确定要删除此标注吗？')
      ])
    },
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      // 删除标注
      if (annotation.id) {
        domAnnotationStore.deleteAnnotation(annotation.id)
      }
    }
  })
}
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
  top: 80px;
  /* transform: translateX(-50%); */
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
  overflow: visible !important;
  /* 覆盖默认的overflow: hidden，允许按钮显示在外部 */
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
  bottom: 0;
  right: 0;
  display: flex;
  gap: 8px;
  margin-top: 4px;
  z-index: 12;
}

.annotation-buttons {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 11;
}

.annotation-buttons-row {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

/* 悬浮时显示按钮 */
.annotation-item:hover .annotation-buttons {
  opacity: 1;
}

/* 按钮样式 */
.annotation-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn {
  color: #409eff;
}

.edit-btn:hover {
  background: #409eff;
  color: white;
}

.more-btn {
  color: #606266;
}

.more-btn:hover {
  background: #606266;
  color: white;
}

.delete-btn {
  color: #f56c6c;
}

.delete-btn:hover {
  background: #f56c6c;
  color: white;
}

.merge-btn {
  color: #67c23a;
}

.merge-btn:hover:not(.btn-disabled) {
  background: #67c23a;
  color: white;
}

.split-btn {
  color: #e6a23c;
}

.split-btn:hover {
  background: #e6a23c;
  color: white;
}

.split-preview {
  margin: 16px 0;
  background: #f8f8f8;
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  line-height: 1.5;
}

.split-text-container {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  line-height: 2;
  padding: 4px 0;
}

.split-char {
  display: inline-block;
  padding: 2px 4px;
  position: relative;
  transition: all 0.2s;
  cursor: pointer;
  user-select: none;
}

.split-char:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.split-position {
  border-right: 2px solid #f56c6c;
}

.hover-split {
  border-right: 2px solid rgba(245, 108, 108, 0.5);
}

.split-first-part {
  background: rgba(103, 194, 58, 0.1);
}

.split-second-part {
  background: rgba(230, 162, 60, 0.1);
}

.split-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* 模态框样式 */
.modal-content {
  display: flex;
  flex-direction: column;
}

.time-range-editor {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.time-editor-label {
  font-size: 14px;
  color: #606266;
}

.modal-annotation-input {
  box-sizing: border-box;
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  resize: none;
  margin-bottom: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

/* 操作杆容器 */
.annotation-handle-container {
  position: absolute;
  width: 4px;
  height: 100%;
  top: 0;
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.annotation-handle-container-left {
  left: 0;
}

.annotation-handle-container-right {
  right: 0;
}

/* 操作杆区域 */
.annotation-handle-section {
  width: 100%;
}

.annotation-handle-top-section {
  height: 40%;
  position: relative;
}

.annotation-handle-middle-section {
  height: 20%;
}

.annotation-handle-bottom-section {
  height: 40%;
  position: relative;
}

/* 基础操作杆样式 */
.annotation-handle {
  width: 100%;
  height: 100%;
  transition: background-color 0.2s ease;
  position: absolute;
  top: 0;
  left: 0;
}

/* 上段操作杆（联动）*/
.annotation-handle-top {
  background-color: rgba(0, 200, 150, 0.6);
  /* 使用不同颜色区分功能 */
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border: 1px dashed rgba(0, 200, 150, 0.8);
  border-bottom: none;
}

.annotation-handle-top:hover {
  background-color: rgba(0, 200, 150, 0.9);
}

.annotation-handle-top:hover::after {
  content: "联动";
  position: absolute;
  top: 50%;
  left: 10px;
  transform: translateY(-50%);
  font-size: 10px;
  color: white;
  white-space: nowrap;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 2px 4px;
  border-radius: 2px;
  pointer-events: none;
}

/* 下段操作杆（独立）*/
.annotation-handle-bottom {
  background-color: rgba(64, 158, 255, 0.5);
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  border: 1px solid rgba(64, 158, 255, 0.7);
  border-top: none;
}

.annotation-handle-bottom:hover {
  background-color: rgba(64, 158, 255, 0.9);
}

.annotation-handle-bottom:hover::after {
  content: "单独";
  position: absolute;
  top: 50%;
  left: 10px;
  transform: translateY(-50%);
  font-size: 10px;
  color: white;
  white-space: nowrap;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 2px 4px;
  border-radius: 2px;
  pointer-events: none;
}

/* 方向特定样式 */
.annotation-handle-left {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  cursor: ew-resize;
}

.annotation-handle-right {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  cursor: ew-resize;
}

/* 联动操作杆特殊鼠标样式 */
.annotation-handle-top.annotation-handle-left,
.annotation-handle-top.annotation-handle-right {
  cursor: ew-resize; /* 或者使用特殊指针 */
}

/* 选中状态 */
.annotation-selected .annotation-handle-bottom {
  background-color: rgba(44, 138, 248, 0.7);
}

.annotation-selected .annotation-handle-top {
  background-color: rgba(0, 200, 150, 0.8);
}
</style>
