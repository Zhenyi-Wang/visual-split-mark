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

// 定义鼠标事件处理返回值类型
type MouseUpResult = 
  | { type: 'annotation'; data: { current: Region & { id: string }; adjacent?: Region & { id: string } } }
  | { type: 'selection' }
  | undefined

export function useInteractionHandler() {
  // 交互模式类型定义
  type InteractionMode = 
    | 'idle'           // 普通状态
    | 'creating'       // 创建选区
    | 'dragging_single'// 拖动单个标注
    | 'dragging_both'  // 拖动相邻标注
    | 'editing'        // 编辑标注文本

  // 拖动信息类型定义
  interface DragInfo {
    handle: 'start' | 'end'
    region: {
      id: string
      region: Region
    }
    adjacent?: {
      id: string
      region: Region
      position: 'left' | 'right'
    }
    snapPoint?: number  // 记录当前的吸附点
  }

  // 状态管理
  const interactionMode = ref<InteractionMode>('idle')
  const dragInfo = ref<DragInfo | null>(null)

  // 基础状态
  const isDragging = ref(false)
  const dragStartX = ref<number | null>(null)
  const selectionStart = ref<number | null>(null)
  const selectionEnd = ref<number | null>(null)
  const selectedRegion = ref<{ start: number; end: number } | null>(null)
  const hoveredRegion = ref<{ id: string; start: number; end: number; text: string } | null>(null)
  const isDraggingAnnotation = ref(false)
  const draggingHandle = ref<'start' | 'end' | null>(null)
  const DRAG_THRESHOLD = 10

  // 相邻标注状态
  const adjacentRegion = ref<{ id: string; region: Region } | null>(null)

  // 回调函数
  const onRegionClick = ref<RegionClickHandler | null>(null)
  const onAnnotationChange = ref<AnnotationChangeHandler | null>(null)
  const onAddButtonClick = ref<ButtonClickHandler | null>(null)
  const onEditButtonClick = ref<ButtonClickHandler | null>(null)
  const onDeleteButtonClick = ref<ButtonClickHandler | null>(null)

  // 获取 viewport store
  const viewport = useViewportStore()

  // 常量定义
  const SNAP_THRESHOLD_PX = 5  // 吸附阈值（像素）

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
    const [annotationStartY, annotationEndY] = getAnnotationYRange(canvas.height)
    
    // 检查是否在波形区域或标注区域内
    const isInWaveformArea = y >= waveformStartY && y <= waveformEndY
    const isInAnnotationArea = y >= annotationStartY && y <= annotationEndY
    if (!isInWaveformArea && !isInAnnotationArea) return null
    
    const time = transform.getTimeFromX(x)

    // 计算波形区域的中点，用于区分上下区域
    const waveformMidY = waveformStartY + WAVEFORM_HEIGHT / 2
    const isInUpperHalf = y < waveformMidY

    for (const [id, region] of regions.entries()) {
      const startX = transform.getXFromTime(region.start)
      const endX = transform.getXFromTime(region.end)
      
      // 增加手柄检测的容差
      const handleTolerance = HANDLE_SIZE * 2

      // 只在波形区域检测手柄
      if (isInWaveformArea) {
        // 检查是否有相邻标注
        let hasLeftAdjacent = false
        let hasRightAdjacent = false
        for (const [otherId, otherRegion] of regions.entries()) {
          if (otherId === id) continue
          if (Math.abs(otherRegion.end - region.start) < 0.01) {
            hasLeftAdjacent = true
          }
          if (Math.abs(otherRegion.start - region.end) < 0.01) {
            hasRightAdjacent = true
          }
        }

        // 判断相邻标注情况
        const hasBothAdjacent = hasLeftAdjacent && hasRightAdjacent
        const hasAnyAdjacent = hasLeftAdjacent || hasRightAdjacent

        // 上半部分：整体调节
        if (isInUpperHalf) {
          if (Math.abs(x - startX) <= handleTolerance) {
            return { 
              id, 
              isHandle: 'start', 
              isTextArea: false,
              handleMode: hasLeftAdjacent ? 'both' : 'single'
            }
          }
          if (Math.abs(x - endX) <= handleTolerance) {
            return { 
              id, 
              isHandle: 'end', 
              isTextArea: false,
              handleMode: hasRightAdjacent ? 'both' : 'single'
            }
          }
        }
        // 下半部分：单独调节（需要在标注区域内）
        else {
          const isInRegionBounds = x >= startX && x <= endX
          if (isInRegionBounds) {
            if (Math.abs(x - startX) <= handleTolerance) {
              return { 
                id, 
                isHandle: 'start', 
                isTextArea: false,
                handleMode: 'single'
              }
            }
            if (Math.abs(x - endX) <= handleTolerance) {
              return { 
                id, 
                isHandle: 'end', 
                isTextArea: false,
                handleMode: 'single'
              }
            }
          }
        }
      }
      
      if (time >= region.start && time <= region.end) {
        return { 
          id, 
          isHandle: null, 
          isTextArea: isInAnnotationArea,
          handleMode: 'none'
        }
      }
    }
    return null
  }

  // 辅助函数：更新标注时间
  const updateRegionTime = (
    regionInfo: { id: string; region: Region },
    handle: 'start' | 'end',
    time: number
  ) => {
    const updated = {
      id: regionInfo.id,
      ...regionInfo.region,
      [handle]: time
    }
    if (onAnnotationChange.value) {
      onAnnotationChange.value(updated)
    }
  }

  // 辅助函数：查找最近的吸附点
  const findSnapPoint = (
    x: number,
    regions: Map<string, Region>,
    currentRegionId: string,
    transform: ReturnType<typeof createTransform>
  ): number | undefined => {
    let closestTime: number | undefined = undefined
    let minDistance = SNAP_THRESHOLD_PX

    for (const [id, region] of regions.entries()) {
      if (id === currentRegionId) continue

      // 将时间点转换为像素位置
      const startX = transform.getXFromTime(region.start)
      const endX = transform.getXFromTime(region.end)

      // 检查开始时间
      const distanceToStart = Math.abs(startX - x)
      if (distanceToStart < minDistance) {
        closestTime = region.start
        minDistance = distanceToStart
      }

      // 检查结束时间
      const distanceToEnd = Math.abs(endX - x)
      if (distanceToEnd < minDistance) {
        closestTime = region.end
        minDistance = distanceToEnd
      }
    }

    return closestTime
  }

  // 辅助函数：处理单个标注拖动
  const handleSingleRegionDrag = (x: number, y: number, transform: ReturnType<typeof createTransform>, regions: Map<string, Region>) => {
    if (!dragInfo.value) return

    const { handle, region } = dragInfo.value
    const time = transform.getTimeFromX(x)

    // 查找吸附点（使用像素位置）
    const snapPoint = findSnapPoint(x, regions, region.id, transform)
    const finalTime = snapPoint ?? time

    // 记录吸附点
    dragInfo.value.snapPoint = snapPoint

    if (handle === 'start') {
      const newTime = Math.min(finalTime, region.region.end - 0.1)
      updateRegionTime(region, handle, newTime)
    } else {
      const newTime = Math.max(finalTime, region.region.start + 0.1)
      updateRegionTime(region, handle, newTime)
    }
  }

  // 辅助函数：处理相邻标注拖动
  const handleBothRegionsDrag = (x: number, y: number, transform: ReturnType<typeof createTransform>, regions: Map<string, Region>) => {
    if (!dragInfo.value?.adjacent) return

    const { handle, region, adjacent } = dragInfo.value
    const time = transform.getTimeFromX(x)

    // 查找吸附点（使用像素位置）
    const snapPoint = findSnapPoint(x, regions, region.id, transform)
    const finalTime = snapPoint ?? time

    // 记录吸附点
    dragInfo.value.snapPoint = snapPoint

    if (handle === 'start' && adjacent.position === 'left') {
      // 更新当前标注的开始时间和左侧标注的结束时间
      const newTime = Math.min(finalTime, region.region.end - 0.1)
      updateRegionTime(region, 'start', newTime)
      updateRegionTime(adjacent, 'end', newTime)
    } else if (handle === 'end' && adjacent.position === 'right') {
      // 更新当前标注的结束时间和右侧标注的开始时间
      const newTime = Math.max(finalTime, region.region.start + 0.1)
      updateRegionTime(region, 'end', newTime)
      updateRegionTime(adjacent, 'start', newTime)
    }
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

  // 辅助函数：检查是否在按钮上
  const isOnButton = (
    x: number,
    y: number,
    buttonBounds: ButtonBounds | null
  ) => {
    if (!buttonBounds) return false
    const { x: bx, y: by, width: bw, height: bh } = buttonBounds
    return x >= bx && x <= bx + bw && y >= by && y <= by + bh
  }

  // 辅助函数：处理按钮点击
  const handleButtonClick = (
    x: number,
    y: number,
    addButtonBounds: ButtonBounds | null,
    editButtonBounds: ButtonBounds | null,
    deleteButtonBounds: ButtonBounds | null
  ) => {
    // 检查添加按钮
    if (isOnButton(x, y, addButtonBounds)) {
      if (onAddButtonClick.value) {
        onAddButtonClick.value()
        setTimeout(clearSelection, 0)
      }
      return true
    }

    // 检查编辑和删除按钮
    if (hoveredRegion.value) {
      if (isOnButton(x, y, editButtonBounds)) {
        if (onEditButtonClick.value) {
          onEditButtonClick.value(hoveredRegion.value.id)
          clearSelection()
          hoveredRegion.value = null
        }
        return true
      }

      if (isOnButton(x, y, deleteButtonBounds)) {
        if (onDeleteButtonClick.value) {
          onDeleteButtonClick.value(hoveredRegion.value.id)
          clearSelection()
          hoveredRegion.value = null
        }
        return true
      }
    }

    return false
  }

  // 辅助函数：更新悬停状态
  const updateHoverState = (
    x: number,
    y: number,
    canvas: HTMLCanvasElement,
    regions: Map<string, Region>,
    addButtonBounds: ButtonBounds | null,
    editButtonBounds: ButtonBounds | null,
    deleteButtonBounds: ButtonBounds | null,
    duration: number
  ) => {
    // 检查是否在按钮上
    const isOnAnyButton = 
      isOnButton(x, y, addButtonBounds) ||
      isOnButton(x, y, editButtonBounds) ||
      isOnButton(x, y, deleteButtonBounds)

    if (!isOnAnyButton) {
      // 检查是否在标注区域
      const regionInfo = findRegionAtPosition(x, y, canvas, duration, regions)
      if (regionInfo && regions.has(regionInfo.id)) {
        const region = regions.get(regionInfo.id)!
        hoveredRegion.value = { id: regionInfo.id, ...region }

        // 查找相邻标注
        adjacentRegion.value = null
        const transform = createTransform(canvas)
        const startX = transform.getXFromTime(region.start)
        const endX = transform.getXFromTime(region.end)
        const isInLeftHalf = x < (startX + endX) / 2

        for (const [id, r] of regions.entries()) {
          if (id === regionInfo.id) continue
          
          // 根据鼠标位置判断高亮左侧还是右侧相邻标注
          if (isInLeftHalf && Math.abs(r.end - region.start) < 0.01) {
            adjacentRegion.value = { id, region: r }
            break
          } else if (!isInLeftHalf && Math.abs(r.start - region.end) < 0.01) {
            adjacentRegion.value = { id, region: r }
            break
          }
        }
      } else {
        hoveredRegion.value = null
        adjacentRegion.value = null
      }
    }

    return { type: 'hover' }
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

    // 检查按钮点击
    if (handleButtonClick(x, y, addButtonBounds, editButtonBounds, deleteButtonBounds)) {
      return clickStartTime
    }

    // 检查标注区域点击
    const regionInfo = findRegionAtPosition(x, y, canvas, duration, regions)
    if (regionInfo) {
      const region = regions.get(regionInfo.id)
      if (!region) return clickStartTime

      if (regionInfo.isTextArea) {
        // 点击文本区域，跳转到标注开始时间
        clearSelection()
        seek(region.start)
        return clickStartTime
      }

      // 处理手柄拖动
      if (regionInfo.isHandle) {
        // 设置拖动信息
        dragInfo.value = {
          handle: regionInfo.isHandle,
          region: {
            id: regionInfo.id,
            region
          }
        }

        // 判断是否需要处理相邻标注
        if (regionInfo.handleMode === 'both') {
          // 查找相邻标注
          for (const [id, r] of regions.entries()) {
            if (id === regionInfo.id) continue
            
            if (regionInfo.isHandle === 'start' && Math.abs(r.end - region.start) < 0.01) {
              dragInfo.value.adjacent = {
                id,
                region: r,
                position: 'left'
              }
              break
            }
            if (regionInfo.isHandle === 'end' && Math.abs(r.start - region.end) < 0.01) {
              dragInfo.value.adjacent = {
                id,
                region: r,
                position: 'right'
              }
              break
            }
          }
          
          // 设置交互模式
          interactionMode.value = dragInfo.value.adjacent ? 'dragging_both' : 'dragging_single'
        } else {
          interactionMode.value = 'dragging_single'
        }

        hoveredRegion.value = { id: regionInfo.id, ...region }
        return clickStartTime
      }
    }

    // 在波形区域创建选区
    const [waveformStartY, waveformEndY] = getWaveformYRange()
    const isInWaveformArea = y >= waveformStartY && y <= waveformEndY

    if (isInWaveformArea) {
      const time = transform.getTimeFromX(x)
      dragStartX.value = x
      interactionMode.value = 'creating'
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

    switch (interactionMode.value) {
      case 'dragging_single':
        handleSingleRegionDrag(x, y, transform, regions)
        return { type: 'annotation' }

      case 'dragging_both':
        handleBothRegionsDrag(x, y, transform, regions)
        return { type: 'annotation' }

      case 'creating':
        if (dragStartX.value !== null) {
          const time = transform.getTimeFromX(x)
          selectionEnd.value = time
          selectedRegion.value = {
            start: Math.min(selectionStart.value!, selectionEnd.value),
            end: Math.max(selectionStart.value!, selectionEnd.value)
          }
          return { type: 'selection' }
        }
        break

      case 'idle':
        // 更新悬停状态
        return updateHoverState(x, y, canvas, regions, addButtonBounds, editButtonBounds, deleteButtonBounds, duration)
    }
  }

  // 处理鼠标抬起事件
  const handleMouseUp = (
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    duration: number,
    seek?: (time: number) => void
  ): MouseUpResult => {
    const transform = createTransform(canvas)
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left

    switch (interactionMode.value) {
      case 'dragging_single':
      case 'dragging_both':
        if (dragInfo.value) {
          // 使用吸附点或鼠标位置
          const time = dragInfo.value.snapPoint ?? transform.getTimeFromX(x)
          const updatedRegion = { ...dragInfo.value.region.region }
          
          if (dragInfo.value.handle === 'start') {
            updatedRegion.start = Math.min(time, dragInfo.value.region.region.end - 0.1)
          } else {
            updatedRegion.end = Math.max(time, dragInfo.value.region.region.start + 0.1)
          }

          // 如果有相邻标注，也要保存
          let updatedAdjacentRegion = null
          if (dragInfo.value.adjacent) {
            updatedAdjacentRegion = { ...dragInfo.value.adjacent.region }
            if (dragInfo.value.handle === 'start' && dragInfo.value.adjacent.position === 'left') {
              updatedAdjacentRegion.end = updatedRegion.start
            } else if (dragInfo.value.handle === 'end' && dragInfo.value.adjacent.position === 'right') {
              updatedAdjacentRegion.start = updatedRegion.end
            }
          }

          // 重置状态
          const result = {
            type: 'annotation' as const,
            data: {
              current: {
                id: dragInfo.value.region.id,
                ...updatedRegion
              },
              adjacent: updatedAdjacentRegion && dragInfo.value.adjacent ? {
                id: dragInfo.value.adjacent.id,
                ...updatedAdjacentRegion
              } : undefined
            }
          }

          // 只清除拖动相关状态
          dragInfo.value = null
          isDragging.value = false
          interactionMode.value = 'idle'
          return result
        }
        break

      case 'creating':
        if (dragStartX.value !== null) {
          const dragDistance = Math.abs(x - dragStartX.value)
          if (dragDistance < DRAG_THRESHOLD && seek) {
            // 视为单击，移动播放条到点击位置
            const time = transform.getTimeFromX(x)
            seek(time)
            clearSelection()
          } else {
            // 完成选区创建，只重置拖动状态
            dragStartX.value = null
            interactionMode.value = 'idle'
          }
          return { type: 'selection' }
        }
        break
    }

    // 只在非创建模式时清除所有状态
    if (interactionMode.value !== 'creating') {
      clearInteractionState()
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

  // 清除交互状态
  const clearInteractionState = () => {
    interactionMode.value = 'idle'
    dragInfo.value = null
    isDragging.value = false
    dragStartX.value = null
    selectionStart.value = null
    selectionEnd.value = null
    selectedRegion.value = null
    // 不要在这里清除 hoveredRegion 和 adjacentRegion
    return true
  }

  return {
    interactionMode,
    dragInfo,
    isDragging,
    selectionStart,
    selectionEnd,
    selectedRegion,
    hoveredRegion: readonly(hoveredRegion),
    adjacentRegion: readonly(adjacentRegion),
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