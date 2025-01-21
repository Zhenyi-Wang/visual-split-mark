import { ref, computed, nextTick, readonly } from 'vue'
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
  BUTTON_SIZE,
  BUTTON_PADDING,
  BUTTON_GAP,
  DEFAULT_PIXELS_PER_SECOND
} from '~/constants/visualizer'
import { useAudioPlayer } from './useAudioPlayer'
import { useWaveformDrawer } from './useWaveformDrawer'
import { useInteractionHandler } from './useInteractionHandler'
import { useRegionManager } from './useRegionManager'
import { useViewportStore } from '~/stores/viewport'

export function useAudioVisualizer() {
  const audioPlayer = useAudioPlayer()
  const waveformDrawer = useWaveformDrawer()
  const interactionHandler = useInteractionHandler()
  const regionManager = useRegionManager()
  const viewport = useViewportStore()
  const editingAnnotation = ref<{ id: string; start: number; end: number; text?: string } | null>(null)
  const selectedRegion = ref<{ start: number; end: number } | null>(null)
  const pixelsPerSecond = ref(50)
  const animationFrame = ref<number | null>(null)
  const isDrawingRequested = ref(false)
  let clickStartTime = 0

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
    
    // 设置持续时间，这会自动初始化视口范围为前30秒
    viewport.setDuration(audioPlayer.duration.value)
    
    waveformDrawer.setChannelData(channelData)

    // 设置回调函数
    interactionHandler.onRegionClick.value = onRegionClickHandler || null
    interactionHandler.onAnnotationChange.value = onAnnotationChangeHandler || null
    
    // 添加音频事件监听
    if (audioPlayer.audioElement.value) {
      audioPlayer.audioElement.value.addEventListener('timeupdate', async () => {
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
        
        await updateDrawing()
      })
    }

    // 添加窗口大小变化监听
    const handleResize = () => {
      if (!waveformDrawer.canvas.value || !container) return
      waveformDrawer.canvas.value.width = container.clientWidth
      updateDrawing()
    }
    
    window.addEventListener('resize', handleResize)
    
    // 将 handleResize 保存到组件实例上，以便在 destroy 时移除
    if (waveformDrawer.canvas.value) {
      (waveformDrawer.canvas.value as any)._resizeHandler = handleResize
    }

    // 添加鼠标事件
    if (waveformDrawer.canvas.value) {
      waveformDrawer.canvas.value.addEventListener('mousedown', async (e) => {
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
        await updateDrawing()
      })

      waveformDrawer.canvas.value.addEventListener('mousemove', async (e) => {
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
        
        if (result) {
          if (result.type === 'annotation' && result.data) {
            // 只更新内部状态，不触发保存
            regionManager.updateRegion(result.data)
          } else if (result.type === 'hover') {
            // 悬停状态已经在 handleMouseMove 中处理
          } else if (result.type === 'selection') {
            // 选区状态已经在 handleMouseMove 中处理
          }
          await updateDrawing()
        }
      })

      waveformDrawer.canvas.value.addEventListener('mouseup', async (e) => {
        if (!waveformDrawer.canvas.value) return
        const result = interactionHandler.handleMouseUp(
          e,
          waveformDrawer.canvas.value,
          audioPlayer.duration.value,
          audioPlayer.seek
        )
        // 如果是标注拖动结束，触发保存
        if (result?.type === 'annotation' && result.data && onAnnotationChangeHandler) {
          onAnnotationChangeHandler(result.data)
        }
        await updateDrawing()
      })

      waveformDrawer.canvas.value.addEventListener('mouseleave', async () => {
        if (!waveformDrawer.canvas.value) return
        if (interactionHandler.handleMouseLeave(waveformDrawer.canvas.value)) {
          await updateDrawing()
        }
      })
    }

    // 设置标注变更回调
    interactionHandler.onAnnotationChange.value = async (annotation) => {
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
      await updateDrawing()
    }

    // 设置按钮回调
    interactionHandler.onAddButtonClick.value = async () => {
      if (interactionHandler.selectionStart.value !== null && interactionHandler.selectionEnd.value !== null) {
        // 设置选区
        selectedRegion.value = {
          start: interactionHandler.selectionStart.value,
          end: interactionHandler.selectionEnd.value
        }
        // 更新绘制，确保选区被更新
        await updateDrawing()
      }
    }

    interactionHandler.onEditButtonClick.value = async (id) => {
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
        await updateDrawing()
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
  const updateDrawing = async () => {
    if (!waveformDrawer.canvas.value) return

    // 如果已经请求了绘制，直接返回
    if (isDrawingRequested.value) return
    
    isDrawingRequested.value = true
    
    // 使用 RAF 进行绘制
    animationFrame.value = requestAnimationFrame(async () => {
      isDrawingRequested.value = false
      
      // 准备选区信息
      const selectionRange = interactionHandler.selectionStart.value !== null && interactionHandler.selectionEnd.value !== null
        ? {
            start: interactionHandler.selectionStart.value,
            end: interactionHandler.selectionEnd.value
          }
        : null

      // 同步更新 selectedRegion
      selectedRegion.value = selectionRange

      // 准备按钮边界信息
      const buttonBounds = {
        add: null,
        edit: null,
        delete: null
      } as {
        add: { x: number; y: number; width: number; height: number } | null;
        edit: { x: number; y: number; width: number; height: number } | null;
        delete: { x: number; y: number; width: number; height: number } | null;
      }

      // 绘制波形
      await waveformDrawer.drawWaveform(
        audioPlayer.duration.value,
        audioPlayer.currentTime.value,
        pixelsPerSecond.value,
        regionManager.getAllRegions(),
        interactionHandler.hoveredRegion.value,
        selectionRange,
        editingAnnotation.value,
        buttonBounds
      )

      // 更新按钮边界引用
      addButtonBounds.value = buttonBounds.add ? { ...buttonBounds.add } : null
      editButtonBounds.value = buttonBounds.edit ? { ...buttonBounds.edit } : null
      deleteButtonBounds.value = buttonBounds.delete ? { ...buttonBounds.delete } : null
    })
  }

  // 销毁函数
  const destroy = () => {
    // 取消未完成的动画帧
    if (animationFrame.value !== null) {
      cancelAnimationFrame(animationFrame.value)
      animationFrame.value = null
    }
    
    // 移除事件监听器
    if (waveformDrawer.canvas.value) {
      const resizeHandler = (waveformDrawer.canvas.value as any)._resizeHandler
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }
    }
    
    // 清理其他资源
    audioPlayer.destroy()
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
    playbackRate: computed(() => audioPlayer.playbackRate.value),

    // 方法
    initialize,
    destroy,
    playPause: audioPlayer.playPause,
    seek: audioPlayer.seek,
    zoomIn: async () => {
      pixelsPerSecond.value = Math.min(pixelsPerSecond.value * 1.5, 1000)
      await updateDrawing();
    },
    zoomOut: async () => {
      pixelsPerSecond.value = Math.max(pixelsPerSecond.value / 1.5, 10)
      await updateDrawing();
    },
    addRegion: regionManager.addRegion,
    updateRegion: regionManager.updateRegion,
    removeRegion: regionManager.removeRegion,
    clearRegions: regionManager.clearRegions,
    clearEditingAnnotation: () => {
      editingAnnotation.value = null;
    },
    setPlaybackRate: audioPlayer.setPlaybackRate,

    // 回调设置
    onAddButtonClick: interactionHandler.onAddButtonClick,
    onEditButtonClick: interactionHandler.onEditButtonClick,
    onDeleteButtonClick: interactionHandler.onDeleteButtonClick,
    updateDrawing
  }
} 