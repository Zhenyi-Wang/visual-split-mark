import { ref } from 'vue'
import type {
  RegionInfo,
  Region,
  ButtonBounds,
  RegionClickHandler,
  AnnotationChangeHandler,
  ButtonClickHandler
} from '~/types/audio'
import {
  PADDING,
  TIME_AXIS_WIDTH,
  WAVEFORM_WIDTH,
  HANDLE_SIZE,
  BUTTON_SIZE
} from '~/constants/visualizer'
import { getTimeFromY } from '~/utils/timeFormat'

export function useInteractionHandler() {
  // 状态
  const isDragging = ref(false)
  const selectionStart = ref<number | null>(null)
  const selectionEnd = ref<number | null>(null)
  const selectedRegion = ref<{ start: number; end: number } | null>(null)
  const hoveredRegion = ref<{ id: string; start: number; end: number; text?: string } | null>(null)
  const isDraggingAnnotation = ref(false)
  const draggingHandle = ref<'start' | 'end' | null>(null)
  const editingAnnotation = ref<{ id: string; start: number; end: number; text?: string } | null>(null)

  // 回调函数
  const onRegionClick = ref<RegionClickHandler | null>(null)
  const onAnnotationChange = ref<AnnotationChangeHandler | null>(null)
  const onAddButtonClick = ref<ButtonClickHandler | null>(null)
  const onEditButtonClick = ref<ButtonClickHandler | null>(null)
  const onDeleteButtonClick = ref<ButtonClickHandler | null>(null)

  // 检查点击位置是否在标注区域内
  const findRegionAtPosition = (
    y: number,
    x: number,
    canvas: HTMLCanvasElement,
    duration: number,
    regions: Map<string, Region>
  ): RegionInfo | null => {
    if (y < PADDING || y > canvas.height - PADDING) return null
    
    const time = getTimeFromY(y, canvas, duration)
    if (time === null) return null

    for (const [id, region] of regions.entries()) {
      const startY = (region.start / duration) * (canvas.height - PADDING * 2) + PADDING
      const endY = (region.end / duration) * (canvas.height - PADDING * 2) + PADDING
      
      if (Math.abs(y - startY) <= HANDLE_SIZE) {
        return { id, isHandle: 'start', isTextArea: false }
      }
      if (Math.abs(y - endY) <= HANDLE_SIZE) {
        return { id, isHandle: 'end', isTextArea: false }
      }
      
      if (time >= region.start && time <= region.end) {
        return { id, isHandle: null, isTextArea: false }
      }
    }
    return null
  }

  // 处理鼠标按下事件
  const handleMouseDown = (
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    duration: number,
    regions: Map<string, Region>,
    addButtonBounds: ButtonBounds | null,
    editButtonBounds: ButtonBounds | null,
    deleteButtonBounds: ButtonBounds | null,
    seek: (time: number) => void
  ) => {
    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const x = e.clientX - rect.left
    const clickStartTime = Date.now()

    // 检查是否点击了编辑或删除按钮
    if (editButtonBounds && hoveredRegion.value) {
      const { x: bx, y: by, width: bw, height: bh } = editButtonBounds
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        if (onEditButtonClick.value) {
          onEditButtonClick.value(hoveredRegion.value.id)
        }
        return clickStartTime
      }
    }

    if (deleteButtonBounds && hoveredRegion.value) {
      const { x: bx, y: by, width: bw, height: bh } = deleteButtonBounds
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        if (onDeleteButtonClick.value) {
          onDeleteButtonClick.value(hoveredRegion.value.id)
        }
        return clickStartTime
      }
    }

    // 检查是否点击了添加按钮
    if (addButtonBounds) {
      const { x: bx, y: by, width: bw, height: bh } = addButtonBounds
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        if (onAddButtonClick.value) {
          onAddButtonClick.value()
        }
        return clickStartTime
      }
    }

    // 检查是否点击了标注区域
    const regionInfo = findRegionAtPosition(y, x, canvas, duration, regions)
    if (!regionInfo) {
      const time = getTimeFromY(y, canvas, duration)
      if (time === null) return clickStartTime
      isDragging.value = true
      selectionStart.value = time
      selectionEnd.value = time
      selectedRegion.value = null
      return clickStartTime
    }

    // 如果点击了手柄，开始拖动
    if (regionInfo.isHandle) {
      const region = regions.get(regionInfo.id)
      if (region) {
        editingAnnotation.value = { id: regionInfo.id, ...region }
        isDraggingAnnotation.value = true
        draggingHandle.value = regionInfo.isHandle
      }
      return clickStartTime
    }

    // 如果点击了标注区域本身，跳转到开始时间
    const region = regions.get(regionInfo.id)
    if (region) {
      seek(region.start)
    }
    return clickStartTime
  }

  // 处理鼠标移动事件
  const handleMouseMove = (
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    duration: number,
    regions: Map<string, Region>,
    addButtonBounds: ButtonBounds | null,
    editButtonBounds: ButtonBounds | null,
    deleteButtonBounds: ButtonBounds | null
  ) => {
    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const x = e.clientX - rect.left
    const time = getTimeFromY(y, canvas, duration)
    if (time === null) return

    // 检查是否在按钮上
    let isOnButton = false

    // 检查编辑和删除按钮（仅在有悬停区域时）
    if (hoveredRegion.value) {
      // 检查编辑按钮
      if (editButtonBounds) {
        const { x: bx, y: by, width: bw, height: bh } = editButtonBounds
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          canvas.style.cursor = 'pointer'
          isOnButton = true
        }
      }
      
      // 检查删除按钮
      if (!isOnButton && deleteButtonBounds) {
        const { x: bx, y: by, width: bw, height: bh } = deleteButtonBounds
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          canvas.style.cursor = 'pointer'
          isOnButton = true
        }
      }
    }

    // 检查添加按钮（仅在有选区时）
    if (!isOnButton && selectionStart.value !== null && selectionEnd.value !== null && addButtonBounds) {
      const { x: bx, y: by, width: bw, height: bh } = addButtonBounds
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        canvas.style.cursor = 'pointer'
        isOnButton = true
      }
    }

    // 更新鼠标样式
    const isInWaveformArea = x >= TIME_AXIS_WIDTH && x <= TIME_AXIS_WIDTH + WAVEFORM_WIDTH
    if (isInWaveformArea && !isOnButton) {
      if (isDraggingAnnotation.value) {
        canvas.style.cursor = 'ns-resize'
      } else {
        // 检查是否在手柄上
        let isOnHandle = false
        for (const [id, region] of regions.entries()) {
          const startY = (region.start / duration) * (canvas.height - PADDING * 2) + PADDING
          const endY = (region.end / duration) * (canvas.height - PADDING * 2) + PADDING
          
          if (Math.abs(y - startY) <= HANDLE_SIZE || Math.abs(y - endY) <= HANDLE_SIZE) {
            canvas.style.cursor = 'ns-resize'
            isOnHandle = true
            break
          }
        }
        if (!isOnHandle) {
          canvas.style.cursor = 'default'
        }
      }
    } else if (!isOnButton) {
      canvas.style.cursor = 'default'
    }

    // 处理拖动和选区
    if (isDraggingAnnotation.value && editingAnnotation.value && draggingHandle.value) {
      // 更新标注边界
      const newAnnotation = { ...editingAnnotation.value }
      if (draggingHandle.value === 'start') {
        newAnnotation.start = Math.min(time, newAnnotation.end)
      } else {
        newAnnotation.end = Math.max(time, newAnnotation.start)
      }
      editingAnnotation.value = newAnnotation
      return { type: 'annotation', data: newAnnotation }
    } else if (isDragging.value) {
      // 更新选区
      selectionEnd.value = time
      return { type: 'selection', data: null }
    } else {
      // 处理悬停效果
      let found = false
      for (const [id, region] of regions.entries()) {
        if (time >= region.start && time <= region.end) {
          hoveredRegion.value = { id, ...region }
          found = true
          break
        }
      }
      if (!found) {
        hoveredRegion.value = null
      }
      return { type: 'hover', data: null }
    }
  }

  // 处理鼠标抬起事件
  const handleMouseUp = (
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    duration: number,
    clickStartTime: number,
    seek: (time: number) => void
  ) => {
    if (isDraggingAnnotation.value && editingAnnotation.value) {
      // 在拖拽结束时触发更新回调
      if (onAnnotationChange.value) {
        onAnnotationChange.value(editingAnnotation.value)
      }
    }
    isDraggingAnnotation.value = false
    draggingHandle.value = null
    
    if (!isDragging.value) return null
    
    const clickDuration = Date.now() - clickStartTime
    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const time = getTimeFromY(y, canvas, duration)
    
    isDragging.value = false
    
    if (clickDuration < 200 && selectionStart.value !== null && Math.abs(selectionStart.value - (time || 0)) < 0.1) {
      // 这是一个点击事件
      selectionStart.value = null
      selectionEnd.value = null
      selectedRegion.value = null
      if (time !== null) {
        seek(time)
      }
      return { type: 'click', data: null }
    } else if (selectionStart.value !== null && time !== null) {
      // 这是一个拖拽事件
      selectedRegion.value = {
        start: Math.min(selectionStart.value, time),
        end: Math.max(selectionStart.value, time)
      }
      return { type: 'selection', data: selectedRegion.value }
    }
    return null
  }

  // 处理鼠标离开事件
  const handleMouseLeave = (canvas: HTMLCanvasElement) => {
    canvas.style.cursor = 'default'
    hoveredRegion.value = null
    if (isDragging.value) {
      isDragging.value = false
    }
    return true
  }

  return {
    // 状态
    isDragging,
    selectionStart,
    selectionEnd,
    selectedRegion,
    hoveredRegion,
    isDraggingAnnotation,
    draggingHandle,
    editingAnnotation,

    // 回调设置
    onRegionClick,
    onAnnotationChange,
    onAddButtonClick,
    onEditButtonClick,
    onDeleteButtonClick,

    // 事件处理方法
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    findRegionAtPosition
  }
} 