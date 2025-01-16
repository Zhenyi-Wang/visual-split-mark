import { ref, computed } from 'vue'
import type { AudioFile } from '~/types/project'
import type {
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
  BUTTON_SIZE,
  BUTTON_PADDING,
  BUTTON_GAP,
  DEFAULT_PIXELS_PER_SECOND
} from '~/constants/visualizer'
import { useAudioPlayer } from './useAudioPlayer'
import { useWaveformDrawer } from './useWaveformDrawer'
import { useInteractionHandler } from './useInteractionHandler'
import { useRegionManager } from './useRegionManager'

export function useAudioVisualizer() {
  const audioPlayer = useAudioPlayer()
  const waveformDrawer = useWaveformDrawer()
  const interactionHandler = useInteractionHandler()
  const regionManager = useRegionManager()
  const pixelsPerSecond = ref(DEFAULT_PIXELS_PER_SECOND)
  let animationFrame: number | null = null

  // 编辑状态管理
  const editingAnnotation = ref<{ id: string; start: number; end: number; text?: string } | null>(null)

  // 添加按钮区域信息
  const addButtonBounds = ref<ButtonBounds | null>(null)
  const editButtonBounds = ref<ButtonBounds | null>(null)
  const deleteButtonBounds = ref<ButtonBounds | null>(null)

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
    interactionHandler.onRegionClick.value = onRegionClickHandler || null
    interactionHandler.onAnnotationChange.value = onAnnotationChangeHandler || null
    
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
      
      // 清除选区
      interactionHandler.clearSelection()
      
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
    waveformDrawer.canvas.value?.addEventListener('mousedown', (e) => {
      if (!waveformDrawer.canvas.value) return
      clickStartTime = interactionHandler.handleMouseDown(
        e,
        waveformDrawer.canvas.value,
        container,
        audioPlayer.duration.value,
        regionManager.getAllRegions(),
        addButtonBounds.value,
        editButtonBounds.value,
        deleteButtonBounds.value,
        audioPlayer.seek
      )
      updateDrawing()
    })

    waveformDrawer.canvas.value?.addEventListener('mousemove', (e) => {
      if (!waveformDrawer.canvas.value) return
      const result = interactionHandler.handleMouseMove(
        e,
        waveformDrawer.canvas.value,
        container,
        audioPlayer.duration.value,
        regionManager.getAllRegions(),
        addButtonBounds.value,
        editButtonBounds.value,
        deleteButtonBounds.value
      )
      if (result?.type === 'annotation' && result.data) {
        regionManager.updateRegion(result.data)
      }
      if (result) {
        updateDrawing()
      }
    })

    waveformDrawer.canvas.value?.addEventListener('mouseup', (e) => {
      if (!waveformDrawer.canvas.value) return
      const result = interactionHandler.handleMouseUp(
        e,
        waveformDrawer.canvas.value,
        container,
        audioPlayer.duration.value,
        clickStartTime,
        audioPlayer.seek
      )
      if (result?.type === 'annotation' && result.data && onAnnotationChangeHandler) {
        onAnnotationChangeHandler(result.data)
      }
      if (result) {
        updateDrawing()
      }
    })

    waveformDrawer.canvas.value?.addEventListener('mouseleave', () => {
      if (!waveformDrawer.canvas.value) return
      if (interactionHandler.handleMouseLeave(waveformDrawer.canvas.value)) {
        updateDrawing()
      }
    })

    // 设置标注变更回调
    interactionHandler.onAnnotationChange.value = (annotation) => {
      // 先更新区域
      regionManager.updateRegion(annotation)
      // 如果不是在拖动状态，才清理状态
      if (!interactionHandler.isDraggingAnnotation.value) {
        interactionHandler.clearAll()
      }
      // 如果是编辑状态，重新设置编辑状态
      if (annotation.id === editingAnnotation.value?.id) {
        editingAnnotation.value = { ...annotation }
      }
      updateDrawing()
    }

    // 设置按钮回调
    interactionHandler.onAddButtonClick.value = () => {
      if (interactionHandler.selectedRegion.value) {
        const id = crypto.randomUUID()
        const annotation: Region & { id: string } = {
          id,
          start: interactionHandler.selectedRegion.value.start,
          end: interactionHandler.selectedRegion.value.end,
          text: ''
        }
        regionManager.addRegion(annotation)
        // 清理所有状态
        interactionHandler.clearAll()
        // 设置为编辑状态
        editingAnnotation.value = { ...annotation }
        updateDrawing()
      }
    }

    interactionHandler.onEditButtonClick.value = (id) => {
      if (!id) return
      const region = regionManager.getRegion(id)
      if (region) {
        // 清理所有状态
        interactionHandler.clearAll()
        // 设置为编辑状态
        editingAnnotation.value = { id, ...region }
        // 触发标注变更回调
        if (onAnnotationChangeHandler) {
          onAnnotationChangeHandler({ id, ...region })
        }
        updateDrawing()
      }
    }

    interactionHandler.onDeleteButtonClick.value = (id) => {
      if (!id) return
      regionManager.removeRegion(id)
      // 清理所有状态
      interactionHandler.clearAll()
      // 清除编辑状态
      if (editingAnnotation.value?.id === id) {
        editingAnnotation.value = null
      }
      updateDrawing()
    }

    // 初始绘制
    updateDrawing()
  }

  // 更新绘制
  const updateDrawing = () => {
    if (!waveformDrawer.canvas.value) return

    // 计算按钮边界信息
    if (interactionHandler.hoveredRegion.value) {
      const startY = (interactionHandler.hoveredRegion.value.start / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      const endY = (interactionHandler.hoveredRegion.value.end / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
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
    if (interactionHandler.selectionStart.value !== null && interactionHandler.selectionEnd.value !== null) {
      const startY = (interactionHandler.selectionStart.value / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
      const endY = (interactionHandler.selectionEnd.value / audioPlayer.duration.value) * (waveformDrawer.canvas.value.height - PADDING * 2) + PADDING
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

    // 准备选区信息
    const selectionRange = interactionHandler.selectionStart.value !== null && interactionHandler.selectionEnd.value !== null
      ? { start: interactionHandler.selectionStart.value, end: interactionHandler.selectionEnd.value }
      : null

    // 准备按钮边界信息
    const buttonBounds = {
      add: addButtonBounds.value,
      edit: editButtonBounds.value,
      delete: deleteButtonBounds.value
    }

    // 绘制波形
    waveformDrawer.drawWaveform(
      audioPlayer.duration.value,
      audioPlayer.currentTime.value,
      pixelsPerSecond.value,
      regionManager.getAllRegions(),
      interactionHandler.hoveredRegion.value,
      selectionRange,
      editingAnnotation.value,
      buttonBounds
    )
  }

  // 销毁函数
  const destroy = () => {
    // 停止动画
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }

    // 移除窗口大小变化监听
    if (waveformDrawer.canvas.value) {
      const resizeHandler = (waveformDrawer.canvas.value as any)._resizeHandler
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }
    }

    // 销毁音频播放器
    audioPlayer.destroy()

    // 清理状态
    interactionHandler.clearAll()
    editingAnnotation.value = null
  }

  return {
    // 状态
    isPlaying: computed(() => audioPlayer.isPlaying.value),
    duration: computed(() => audioPlayer.duration.value),
    currentTime: computed(() => audioPlayer.currentTime.value),
    pixelsPerSecond,
    selectedRegion: computed(() => interactionHandler.selectedRegion.value),
    editingAnnotation,

    // 方法
    initialize,
    destroy,
    playPause: audioPlayer.playPause,
    seek: audioPlayer.seek,
    zoomIn: () => {
      pixelsPerSecond.value = Math.min(pixelsPerSecond.value * 1.5, 1000)
      updateDrawing()
    },
    zoomOut: () => {
      pixelsPerSecond.value = Math.max(pixelsPerSecond.value / 1.5, 10)
      updateDrawing()
    },
    addRegion: regionManager.addRegion,
    updateRegion: regionManager.updateRegion,
    removeRegion: regionManager.removeRegion,
    clearRegions: regionManager.clearRegions,
    playbackRate: computed(() => audioPlayer.playbackRate.value),
    setPlaybackRate: audioPlayer.setPlaybackRate,

    // 回调设置
    onAddButtonClick: interactionHandler.onAddButtonClick,
    onEditButtonClick: interactionHandler.onEditButtonClick,
    onDeleteButtonClick: interactionHandler.onDeleteButtonClick
  }
} 