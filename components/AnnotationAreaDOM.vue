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
      <div v-else class="annotation-edit-container">
        <textarea ref="editAnnotationInputRef" v-model="tempAnnotationText" class="annotation-input"
          placeholder="Ctrl+回车保存, Esc取消" rows="3" @keyup.enter.ctrl="confirmEditAnnotation"
          @keyup.esc="cancelEditAnnotation"></textarea>

        <div class="annotation-edit-actions">
          <n-button size="small" @click="cancelEditAnnotation">
            取消
          </n-button>
          <n-button size="small" type="primary" @click="confirmEditAnnotation">
            确认
          </n-button>
        </div>
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

    <!-- 分割标注模态框 -->
    <n-modal v-model:show="showSplitModal" preset="card" title="分割标注" style="width: 400px">
      <p>请点击要分割的位置：</p>
      <div class="split-preview">
        <div class="split-text-container">
          <span v-for="(char, index) in splitText" 
                :key="index" 
                class="split-char" 
                :class="{ 
                  'split-first-part': index < splitPosition, 
                  'split-second-part': index >= splitPosition,
                  'split-position': index === splitPosition - 1,
                  'hover-split': previewSplitPosition !== null && index === previewSplitPosition - 1
                }"
                @click="splitPosition = index + 1"
                @mouseover="previewSplitPosition = index + 1"
                @mouseleave="previewSplitPosition = null">{{ char }}</span>
        </div>
      </div>
      <div class="split-actions">
        <n-button @click="cancelSplit">取消</n-button>
        <n-button type="primary" @click="confirmSplit">确认分割</n-button>
      </div>
    </n-modal>

    <!-- 标注操作菜单 -->
    <n-dropdown
      :show="showDropdown"
      :options="dropdownOptions"
      :x="dropdownX"
      :y="dropdownY"
      placement="bottom-start"
      @select="handleDropdownSelect"
      @clickoutside="hideAnnotationMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, h } from 'vue'
import { NIcon, NButton, useDialog, NModal, NInput, NCheckbox } from 'naive-ui'
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
    props.audioPlayer.seek(annotation.start)
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

// 处理编辑按钮点击
const handleEditClick = (annotation: any) => {
  // 设置编辑状态
  domAnnotationStore.setAnnotationState('editing_text')
  domAnnotationStore.uiState.editingAnnotationId = annotation.id

  // 设置临时文本
  tempAnnotationText.value = annotation.text || ''

  // 延迟聚焦输入框
  setTimeout(() => {
    if (editAnnotationInputRef.value) {
      try {
        editAnnotationInputRef.value.focus()
      } catch (error) {
        console.error('无法聚焦编辑输入框:', error)
      }
    } else {
      console.warn('编辑输入框引用为空')
    }
  }, 100)
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

// 确认编辑
const confirmEditAnnotation = () => {
  console.log('确认编辑', domAnnotationStore.uiState.editingAnnotationId, tempAnnotationText.value)
  const editingId = domAnnotationStore.uiState.editingAnnotationId
  if (editingId) {
    // 更新标注文本
    domAnnotationStore.updateAnnotation(editingId, {
      text: tempAnnotationText.value
    })

    // 重置状态
    domAnnotationStore.setAnnotationState('idle')
    domAnnotationStore.uiState.editingAnnotationId = null
    tempAnnotationText.value = ''
  }
}

// 取消编辑
const cancelEditAnnotation = () => {
  domAnnotationStore.setAnnotationState('idle')
  domAnnotationStore.uiState.editingAnnotationId = null
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

// 标注菜单相关状态
const showDropdown = ref(false)
const dropdownX = ref(0)
const dropdownY = ref(0)
const currentMenuAnnotation = ref<any>(null)
const dropdownOptions = computed(() => {
  const annotation = currentMenuAnnotation.value
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
      disabled: !annotation || !hasPreviousAnnotation(annotation)
    },
    {
      label: '合并到右边',
      key: 'merge_right',
      icon: () => h(MergeCells, { style: { transform: 'rotate(180deg)' } }),
      disabled: !annotation || !hasNextAnnotation(annotation)
    },
    {
      label: '分割标注',
      key: 'split',
      icon: () => h(Split)
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
  }
  
  // 选择后隐藏菜单
  hideAnnotationMenu()
}

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
</style>
