import { ref, computed } from 'vue'
import type {
  RegionInfo,
  Region,
  ButtonBounds,
  RegionClickHandler,
  AnnotationChangeHandler,
  ButtonClickHandler
} from '~/types/audio'
import {
  TIME_AXIS_HEIGHT,
  WAVEFORM_HEIGHT,
  ANNOTATION_HEIGHT,
  HANDLE_SIZE,
  BUTTON_SIZE,
  BUTTON_GAP
} from '~/constants/visualizer'
import { useCoordinateTransform } from './useCoordinateTransform'
import { useViewportStore } from '~/stores/viewport'
import { getWaveformYRange, getAnnotationYRange } from '~/utils/timeFormat'

export function useInteractionHandler() {
  // 状态
  const isDragging = ref(false)
  const selectionStart = ref<number | null>(null)
  const selectionEnd = ref<number | null>(null)
  const selectedRegion = ref<{ start: number; end: number } | null>(null)
  const hoveredRegion = ref<{ id: string; start: number; end: number; text: string } | null>(null)
  const isDraggingAnnotation = ref(false)
  const draggingHandle = ref<'start' | 'end' | null>(null)
  const dragStartX = ref<number | null>(null)
  const DRAG_THRESHOLD = 10

  // 回调函数
  const onRegionClick = ref<RegionClickHandler | null>(null)
  const onAnnotationChange = ref<AnnotationChangeHandler | null>(null)
  const onAddButtonClick = ref<ButtonClickHandler | null>(null)
  const onEditButtonClick = ref<ButtonClickHandler | null>(null)
  const onDeleteButtonClick = ref<ButtonClickHandler | null>(null)

  // 获取 viewport store
  const viewport = useViewportStore()

  // 创建坐标转换器
  const createTransform = (canvas: HTMLCanvasElement) => {
    return useCoordinateTransform({
      startTime: computed(() => viewport.startTime),
      endTime: computed(() => viewport.endTime),
      width: computed(() => canvas.width)
    })
  }

  // 检查点击位置是否在标注区域内
  const findRegionAtPosition = (
    x: number,
    y: number,
    canvas: HTMLCanvasElement,
    duration: number,
    regions: Map<string, Region>
  ): RegionInfo | null => {
    const transform = createTransform(canvas)

    // 获取波形区域和标注区域的Y坐标范围
    const [waveformStartY, waveformEndY] = getWaveformYRange()
    const [annotationStartY, annotationEndY] = getAnnotationYRange()
    
    // 检查是否在波形区域或标注区域内
    const isInWaveformArea = y >= waveformStartY && y <= waveformEndY
    const isInAnnotationArea = y >= annotationStartY && y <= annotationEndY
    if (!isInWaveformArea && !isInAnnotationArea) return null
    
    const time = transform.getTimeFromX(x)

    for (const [id, region] of regions.entries()) {
      const startX = transform.getXFromTime(region.start)
      const endX = transform.getXFromTime(region.end)
      
      // 增加手柄检测的容差
      const handleTolerance = HANDLE_SIZE * 2
      // 只在波形区域检测手柄
      if (isInWaveformArea) {
        if (Math.abs(x - startX) <= handleTolerance) {
          return { id, isHandle: 'start', isTextArea: false }
        }
        if (Math.abs(x - endX) <= handleTolerance) {
          return { id, isHandle: 'end', isTextArea: false }
        }
      }
      
      if (time >= region.start && time <= region.end) {
        return { 
          id, 
          isHandle: null, 
          isTextArea: isInAnnotationArea 
        }
      }
    }
    return null
  }

  // 清除选区
  const clearSelection = () => {
    selectionStart.value = null
    selectionEnd.value = null
    dragStartX.value = null
    selectedRegion.value = null
    return true
  }

  // 清除所有状态
  const clearAll = () => {
    clearSelection()
    isDragging.value = false
    isDraggingAnnotation.value = false
    draggingHandle.value = null
    hoveredRegion.value = null
    return true
  }

  // 清除交互状态
  const clearInteractionState = () => {
    isDragging.value = false
    isDraggingAnnotation.value = false
    draggingHandle.value = null
    hoveredRegion.value = null
    return true
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
    const transform = createTransform(canvas)

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const clickStartTime = Date.now()

    // 检查是否点击了添加按钮
    if (addButtonBounds) {
      const { x: bx, y: by, width: bw, height: bh } = addButtonBounds
      const isClicked = x >= bx && x <= bx + bw && y >= by && y <= by + bh
      if (isClicked) {
        if (onAddButtonClick.value) {
          onAddButtonClick.value()
          // 在回调函数执行后再清除选区
          setTimeout(() => {
            clearSelection()
          }, 0)
        }
        return clickStartTime
      }
    }

    // 检查是否点击了编辑或删除按钮
    if (hoveredRegion.value) {
      // 检查编辑按钮
      if (editButtonBounds) {
        const { x: bx, y: by, width: bw, height: bh } = editButtonBounds
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          if (onEditButtonClick.value) {
            onEditButtonClick.value(hoveredRegion.value.id)
            clearSelection()
            hoveredRegion.value = null
          }
          return clickStartTime
        }
      }

      // 检查删除按钮
      if (deleteButtonBounds) {
        const { x: bx, y: by, width: bw, height: bh } = deleteButtonBounds
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          if (onDeleteButtonClick.value) {
            onDeleteButtonClick.value(hoveredRegion.value.id)
            clearSelection()
            hoveredRegion.value = null
          }
          return clickStartTime
        }
      }
    }

    // 检查是否点击了标注区域
    const regionInfo = findRegionAtPosition(x, y, canvas, duration, regions)
    const [waveformStartY, waveformEndY] = getWaveformYRange()
    const isInWaveformArea = y >= waveformStartY && y <= waveformEndY

    if (regionInfo) {
      const region = regions.get(regionInfo.id)
      if (region) {
        if (regionInfo.isTextArea) {
          clearSelection()
          seek(region.start)
          return clickStartTime
        }

        // 检查是否点击了手柄
        const startX = transform.getXFromTime(region.start)
        const endX = transform.getXFromTime(region.end)

        if (isInWaveformArea) {
          if (Math.abs(x - startX) <= HANDLE_SIZE) {
            isDraggingAnnotation.value = true
            draggingHandle.value = 'start'
            hoveredRegion.value = { id: regionInfo.id, ...region }
            return clickStartTime
          } else if (Math.abs(x - endX) <= HANDLE_SIZE) {
            isDraggingAnnotation.value = true
            draggingHandle.value = 'end'
            hoveredRegion.value = { id: regionInfo.id, ...region }
            return clickStartTime
          }
        }
      }
    }

    // 在波形区域创建选区
    const time = transform.getTimeFromX(x)

    if (isInWaveformArea) {
      dragStartX.value = x
      isDragging.value = true
      selectionStart.value = time
      selectionEnd.value = time
      selectedRegion.value = null
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
    const transform = createTransform(canvas)

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const time = transform.getTimeFromX(x)

    // 获取波形和标注区域的Y坐标范围
    const [waveformStartY, waveformEndY] = getWaveformYRange()
    const [annotationStartY, annotationEndY] = getAnnotationYRange()
    const isInWaveformArea = y >= waveformStartY && y <= waveformEndY
    const isInAnnotationArea = y >= annotationStartY && y <= annotationEndY

    // 检查是否在按钮上
    let isOnButton = false

    // 检查添加按钮
    if (addButtonBounds) {
      const { x: bx, y: by, width: bw, height: bh } = addButtonBounds
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        isOnButton = true
      }
    }

    // 检查编辑和删除按钮
    if (hoveredRegion.value) {
      if (editButtonBounds) {
        const { x: bx, y: by, width: bw, height: bh } = editButtonBounds
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          isOnButton = true
        }
      }
      if (deleteButtonBounds) {
        const { x: bx, y: by, width: bw, height: bh } = deleteButtonBounds
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          isOnButton = true
        }
      }
    }

    // 如果在拖动标注
    if (isDraggingAnnotation.value && hoveredRegion.value && draggingHandle.value) {
      const updatedRegion = { ...hoveredRegion.value }
      if (draggingHandle.value === 'start') {
        updatedRegion.start = Math.min(time, updatedRegion.end - 0.1)
      } else {
        updatedRegion.end = Math.max(time, updatedRegion.start + 0.1)
      }
      if (onAnnotationChange.value) {
        onAnnotationChange.value(updatedRegion)
      }
      return { type: 'annotation', data: updatedRegion }
    }

    // 如果在创建选区
    if (isDragging.value) {
      if (dragStartX.value !== null) {
        selectionEnd.value = time
        selectedRegion.value = {
          start: Math.min(selectionStart.value!, selectionEnd.value),
          end: Math.max(selectionStart.value!, selectionEnd.value)
        }
      }
      return { type: 'selection' }
    }

    // 检查是否悬停在标注上
    if (!isOnButton && isInWaveformArea) {
      let isOnHandle = false
      for (const [id, region] of regions.entries()) {
        const startX = transform.getXFromTime(region.start)
        const endX = transform.getXFromTime(region.end)
        
        if (Math.abs(x - startX) <= HANDLE_SIZE || Math.abs(x - endX) <= HANDLE_SIZE) {
          isOnHandle = true
          if (!hoveredRegion.value || hoveredRegion.value.id !== id) {
            hoveredRegion.value = { id, ...region }
            return { type: 'hover' }
          }
          break
        }
      }

      if (!isOnHandle) {
        const regionInfo = findRegionAtPosition(x, y, canvas, duration, regions)
        if (regionInfo) {
          const region = regions.get(regionInfo.id)
          if (region && (!hoveredRegion.value || hoveredRegion.value.id !== regionInfo.id)) {
            hoveredRegion.value = { id: regionInfo.id, ...region }
            return { type: 'hover' }
          }
        } else if (hoveredRegion.value) {
          hoveredRegion.value = null
          return { type: 'hover' }
        }
      }
    }
  }

  // 处理鼠标抬起事件
  const handleMouseUp = (
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    duration: number,
    seek?: (time: number) => void
  ) => {
    const transform = createTransform(canvas)

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left

    if (isDraggingAnnotation.value && hoveredRegion.value && draggingHandle.value) {
      const time = transform.getTimeFromX(x)
      const updatedRegion = { ...hoveredRegion.value }
      if (draggingHandle.value === 'start') {
        updatedRegion.start = Math.min(time, updatedRegion.end - 0.1)
      } else {
        updatedRegion.end = Math.max(time, updatedRegion.start + 0.1)
      }
      isDraggingAnnotation.value = false
      draggingHandle.value = null
      return { type: 'annotation', data: updatedRegion }
    }

    if (isDragging.value) {
      isDragging.value = false
      if (dragStartX.value !== null) {
        const dragDistance = Math.abs(x - dragStartX.value)
        if (dragDistance < DRAG_THRESHOLD) {
          // 视为单击，移动播放条到点击位置
          const time = transform.getTimeFromX(x)
          if (seek) {
            seek(time)
          }
          clearSelection()
        }
        dragStartX.value = null
      }
    }
  }

  // 处理鼠标离开事件
  const handleMouseLeave = (canvas: HTMLCanvasElement) => {
    if (hoveredRegion.value) {
      hoveredRegion.value = null
      return true
    }
    return false
  }

  return {
    isDragging,
    selectionStart,
    selectionEnd,
    selectedRegion,
    hoveredRegion,
    isDraggingAnnotation,
    draggingHandle,
    onRegionClick,
    onAnnotationChange,
    onAddButtonClick,
    onEditButtonClick,
    onDeleteButtonClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    clearSelection,
    clearAll,
    clearInteractionState
  }
} 