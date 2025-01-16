import { ref } from 'vue'
import type { AudioFile } from '~/types/project'
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
  BUTTON_SIZE,
  BUTTON_PADDING,
  BUTTON_GAP,
  DEFAULT_PIXELS_PER_SECOND
} from '~/constants/visualizer'
import { getTimeFromY } from '~/utils/timeFormat'
import { useAudioPlayer } from './useAudioPlayer'
import { useWaveformDrawer } from './useWaveformDrawer'

export function useAudioVisualizer() {
  const audioPlayer = useAudioPlayer()
  const waveformDrawer = useWaveformDrawer()
  const pixelsPerSecond = ref(DEFAULT_PIXELS_PER_SECOND)
  let animationFrame: number | null = null
  const isDragging = ref(false)
  const selectionStart = ref<number | null>(null)
  const selectionEnd = ref<number | null>(null)
  const selectedRegion = ref<{ start: number; end: number } | null>(null)
  const regions = ref<Map<string, Region>>(new Map())
  const hoveredRegion = ref<{ id: string; start: number; end: number; text?: string } | null>(null)
  const onRegionClick = ref<RegionClickHandler | null>(null)
  const isDraggingAnnotation = ref(false)
  const draggingHandle = ref<'start' | 'end' | null>(null)
  const editingAnnotation = ref<{ id: string; start: number; end: number; text?: string } | null>(null)
  const onAnnotationChange = ref<AnnotationChangeHandler | null>(null)

  // 添加按钮区域信息
  const addButtonBounds = ref<ButtonBounds | null>(null)
  const editButtonBounds = ref<ButtonBounds | null>(null)
  const deleteButtonBounds = ref<ButtonBounds | null>(null)

  // 添加按钮点击回调
  const onAddButtonClick = ref<ButtonClickHandler | null>(null)
  const onEditButtonClick = ref<ButtonClickHandler | null>(null)
  const onDeleteButtonClick = ref<ButtonClickHandler | null>(null)

  const initialize = async (
    container: HTMLElement, 
    audioFile: AudioFile, 
    onRegionClickHandler?: RegionClickHandler,
    onAnnotationChangeHandler?: AnnotationChangeHandler
  ) => {
    // 初始化音频播放器
    const channelData = await audioPlayer.initialize(audioFile)
    
    // 初始化波形绘制器
    waveformDrawer.initialize(container)
    waveformDrawer.setChannelData(channelData)

    // 设置回调函数
    onRegionClick.value = onRegionClickHandler || null
    onAnnotationChange.value = onAnnotationChangeHandler || null

    // 添加音频事件监听
    audioPlayer.audioElement.value?.addEventListener('timeupdate', () => {
      // 计算当前播放位置对应的 Y 坐标
      if (!waveformDrawer.canvas.value) return
      const currentY = (audioPlayer.currentTime.value / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      
      // 获取容器的可视区域高度
      const containerHeight = container.clientHeight
      
      // 计算滚动位置，使播放位置保持在视图中间
      const targetScrollTop = currentY - containerHeight / 2
      
      // 平滑滚动到目标位置
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      })
      
      updateDrawing()
    })

    // 添加窗口大小变化监听
    const handleResize = () => {
      if (!waveformDrawer.canvas.value || !container) return
      waveformDrawer.canvas.value.width = container.clientWidth
      updateDrawing()
    }
    
    window.addEventListener('resize', handleResize)
    
    // 将 handleResize 保存到组件实例上，以便在 destroy 时移除
    ;(waveformDrawer.canvas.value as any)._resizeHandler = handleResize

    // 添加鼠标事件
    let clickStartTime = 0
    const CLICK_THRESHOLD = 200 // 判断点击的时间阈值

    waveformDrawer.canvas.value?.addEventListener('mousedown', (e) => {
      if (!waveformDrawer.canvas.value) return
      clickStartTime = Date.now()
      const rect = waveformDrawer.canvas.value.getBoundingClientRect()
      const y = e.clientY - rect.top + container.scrollTop
      const x = e.clientX - rect.left

      // 检查是否点击了编辑或删除按钮
      if (editButtonBounds.value && hoveredRegion.value) {
        const { x: bx, y: by, width: bw, height: bh } = editButtonBounds.value
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          if (onEditButtonClick.value) {
            onEditButtonClick.value(hoveredRegion.value.id)
          }
          return
        }
      }

      if (deleteButtonBounds.value && hoveredRegion.value) {
        const { x: bx, y: by, width: bw, height: bh } = deleteButtonBounds.value
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          if (onDeleteButtonClick.value) {
            onDeleteButtonClick.value(hoveredRegion.value.id)
          }
          return
        }
      }

      // 检查是否点击了添加按钮
      if (addButtonBounds.value) {
        const { x: bx, y: by, width: bw, height: bh } = addButtonBounds.value
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          if (onAddButtonClick.value) {
            onAddButtonClick.value()
          }
          return
        }
      }

      // 检查是否点击了标注区域
      const regionInfo = findRegionAtPosition(y, x)
      if (!regionInfo) {
        // 如果没有点击到任何区域，开始选区
        const time = getTimeFromY(y, waveformDrawer.canvas.value, audioPlayer.duration.value)
        if (time === null) return
        isDragging.value = true
        selectionStart.value = time
        selectionEnd.value = time
        selectedRegion.value = null
        updateDrawing()
        return
      }

      // 如果点击了手柄，开始拖动
      if (regionInfo.isHandle) {
        const region = regions.value.get(regionInfo.id)
        if (region) {
          editingAnnotation.value = { id: regionInfo.id, ...region }
          isDraggingAnnotation.value = true
          draggingHandle.value = regionInfo.isHandle
        }
        return
      }

      // 如果点击了标注区域本身，跳转到开始时间
      const region = regions.value.get(regionInfo.id)
      if (region) {
        audioPlayer.seek(region.start)
      }
    })

    waveformDrawer.canvas.value?.addEventListener('mousemove', (e) => {
      if (!waveformDrawer.canvas.value) return
      const rect = waveformDrawer.canvas.value.getBoundingClientRect()
      const y = e.clientY - rect.top + container.scrollTop
      const x = e.clientX - rect.left
      const time = getTimeFromY(y, waveformDrawer.canvas.value, audioPlayer.duration.value)
      if (time === null) return

      // 检查是否在按钮上
      let isOnButton = false

      // 检查编辑和删除按钮（仅在有悬停区域时）
      if (hoveredRegion.value) {
        // 检查编辑按钮
        if (editButtonBounds.value) {
          const { x: bx, y: by, width: bw, height: bh } = editButtonBounds.value
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
            waveformDrawer.canvas.value.style.cursor = 'pointer'
            isOnButton = true
          }
        }
        
        // 检查删除按钮
        if (!isOnButton && deleteButtonBounds.value) {
          const { x: bx, y: by, width: bw, height: bh } = deleteButtonBounds.value
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
            waveformDrawer.canvas.value.style.cursor = 'pointer'
            isOnButton = true
          }
        }
      }

      // 检查添加按钮（仅在有选区时）
      if (!isOnButton && selectionStart.value !== null && selectionEnd.value !== null && addButtonBounds.value) {
        const { x: bx, y: by, width: bw, height: bh } = addButtonBounds.value
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          waveformDrawer.canvas.value.style.cursor = 'pointer'
          isOnButton = true
        }
      }

      // 更新鼠标样式
      const isInWaveformArea = x >= TIME_AXIS_WIDTH && x <= TIME_AXIS_WIDTH + WAVEFORM_WIDTH
      if (isInWaveformArea && !isOnButton) {
        if (isDraggingAnnotation.value) {
          waveformDrawer.canvas.value.style.cursor = 'ns-resize'
        } else {
          // 检查是否在手柄上
          let isOnHandle = false
          for (const [id, region] of regions.value.entries()) {
            const startY = (region.start / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
            const endY = (region.end / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
            
            if (Math.abs(y - startY) <= HANDLE_SIZE || Math.abs(y - endY) <= HANDLE_SIZE) {
              waveformDrawer.canvas.value.style.cursor = 'ns-resize'
              isOnHandle = true
              break
            }
          }
          if (!isOnHandle) {
            waveformDrawer.canvas.value.style.cursor = 'default'
          }
        }
      } else if (!isOnButton) {
        waveformDrawer.canvas.value.style.cursor = 'default'
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
        regions.value.set(newAnnotation.id, newAnnotation)
        updateDrawing()
      } else if (isDragging.value) {
        // 更新选区
        selectionEnd.value = time
        updateDrawing()
      } else {
        // 处理悬停效果
        let found = false
        for (const [id, region] of regions.value.entries()) {
          if (time >= region.start && time <= region.end) {
            hoveredRegion.value = { id, ...region }
            found = true
            break
          }
        }
        if (!found) {
          hoveredRegion.value = null
        }
        updateDrawing()
      }
    })

    waveformDrawer.canvas.value?.addEventListener('mouseup', (e: MouseEvent) => {
      if (isDraggingAnnotation.value && editingAnnotation.value) {
        // 在拖拽结束时触发更新回调
        if (onAnnotationChangeHandler) {
          onAnnotationChangeHandler(editingAnnotation.value)
        }
      }
      isDraggingAnnotation.value = false
      draggingHandle.value = null
      if (!waveformDrawer.canvas.value || !isDragging.value) return
      
      const clickDuration = Date.now() - clickStartTime
      const rect = waveformDrawer.canvas.value.getBoundingClientRect()
      const y = e.clientY - rect.top + container.scrollTop
      const time = getTimeFromY(y, waveformDrawer.canvas.value, audioPlayer.duration.value)
      
      isDragging.value = false
      
      if (clickDuration < CLICK_THRESHOLD && selectionStart.value !== null && Math.abs(selectionStart.value - (time || 0)) < 0.1) {
        // 这是一个点击事件
        selectionStart.value = null
        selectionEnd.value = null
        selectedRegion.value = null
        audioPlayer.seek(time || 0)
      } else if (selectionStart.value !== null && time !== null) {
        // 这是一个拖拽事件
        selectedRegion.value = {
          start: Math.min(selectionStart.value, time),
          end: Math.max(selectionStart.value, time)
        }
      }
      
      updateDrawing()
    })

    // 添加鼠标离开事件处理
    waveformDrawer.canvas.value?.addEventListener('mouseleave', () => {
      if (!waveformDrawer.canvas.value) return
      waveformDrawer.canvas.value.style.cursor = 'default'
      hoveredRegion.value = null
      if (isDragging.value) {
        isDragging.value = false
      }
      updateDrawing()
    })

    // 初始绘制
    updateDrawing()
  }

  // 检查点击位置是否在标注区域内
  const findRegionAtPosition = (y: number, x: number): RegionInfo | null => {
    if (!waveformDrawer.canvas.value || !audioPlayer.duration.value) return null
    
    // 排除时间轴区域的点击
    if (y < PADDING || y > waveformDrawer.canvas.value.height - PADDING) return null
    
    // 计算时间点
    const time = getTimeFromY(y, waveformDrawer.canvas.value, audioPlayer.duration.value)
    if (time === null) return null

    // 查找包含该时间点的区域
    for (const [id, region] of regions.value.entries()) {
      const startY = (region.start / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      const endY = (region.end / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      
      // 检查是否点击了手柄
      if (Math.abs(y - startY) <= HANDLE_SIZE) {
        return { id, isHandle: 'start', isTextArea: false }
      }
      if (Math.abs(y - endY) <= HANDLE_SIZE) {
        return { id, isHandle: 'end', isTextArea: false }
      }
      
      // 检查是否在区域内
      if (time >= region.start && time <= region.end) {
        return { id, isHandle: null, isTextArea: false }
      }
    }
    return null
  }

  // 更新绘制
  const updateDrawing = () => {
    if (!waveformDrawer.canvas.value) return

    // 计算按钮边界信息
    if (hoveredRegion.value) {
      const startY = (hoveredRegion.value.start / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      const endY = (hoveredRegion.value.end / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      const buttonY = Math.min(startY, endY) + BUTTON_PADDING

      // 删除按钮（在最右边）
      const deleteButtonX = waveformDrawer.canvas.value.width - BUTTON_SIZE - BUTTON_PADDING
      deleteButtonBounds.value = {
        x: deleteButtonX,
        y: buttonY,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE
      }

      // 编辑按钮（在删除按钮左边）
      const editButtonX = deleteButtonX - BUTTON_SIZE - BUTTON_GAP
      editButtonBounds.value = {
        x: editButtonX,
        y: buttonY,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE
      }
    } else {
      deleteButtonBounds.value = null
      editButtonBounds.value = null
    }

    // 计算添加按钮边界
    if (selectionStart.value !== null && selectionEnd.value !== null) {
      const startY = (selectionStart.value / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      const endY = (selectionEnd.value / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      const buttonX = TIME_AXIS_WIDTH + WAVEFORM_WIDTH - BUTTON_SIZE - BUTTON_PADDING
      const buttonY = Math.min(startY, endY) + BUTTON_PADDING

      addButtonBounds.value = {
        x: buttonX,
        y: buttonY,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE
      }
    } else {
      addButtonBounds.value = null
    }

    // 准备按钮边界信息
    const buttonBounds = {
      add: addButtonBounds.value,
      edit: editButtonBounds.value,
      delete: deleteButtonBounds.value
    }

    // 准备选区信息
    const selectionRange = selectionStart.value !== null && selectionEnd.value !== null
      ? { start: selectionStart.value, end: selectionEnd.value }
      : null

    // 调用波形绘制器的绘制方法
    waveformDrawer.drawWaveform(
      audioPlayer.duration.value,
      audioPlayer.currentTime.value,
      pixelsPerSecond.value,
      regions.value,
      hoveredRegion.value,
      selectionRange,
      editingAnnotation.value,
      buttonBounds
    )
  }

  const destroy = () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
    audioPlayer.destroy()
    waveformDrawer.destroy()
    if (waveformDrawer.canvas.value) {
      window.removeEventListener('resize', (waveformDrawer.canvas.value as any)._resizeHandler)
    }
  }

  const setZoom = (value: number) => {
    pixelsPerSecond.value = Math.max(1, Math.min(500, value))
    updateDrawing()
  }

  const zoomIn = () => {
    setZoom(pixelsPerSecond.value * 1.2)
  }

  const zoomOut = () => {
    setZoom(pixelsPerSecond.value / 1.2)
  }

  // 区域管理方法
  const addRegion = (annotation: Region & { id: string }) => {
    regions.value.set(annotation.id, annotation)
    updateDrawing()
  }

  const updateRegion = (annotation: Region & { id: string }) => {
    regions.value.set(annotation.id, annotation)
    updateDrawing()
  }

  const removeRegion = (id: string) => {
    regions.value.delete(id)
    updateDrawing()
  }

  const clearRegions = () => {
    regions.value.clear()
    updateDrawing()
  }

  return {
    ...audioPlayer,
    pixelsPerSecond,
    selectedRegion,
    editingAnnotation,
    regions,
    hoveredRegion,
    initialize,
    destroy,
    zoomIn,
    zoomOut,
    setZoom,
    addRegion,
    updateRegion,
    removeRegion,
    clearRegions,
    onAddButtonClick,
    onEditButtonClick,
    onDeleteButtonClick,
  }
} 