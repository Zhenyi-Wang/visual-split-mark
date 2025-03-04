import { ref, computed, nextTick, readonly, unref } from 'vue'
import { useMessage } from 'naive-ui'
import type { AudioFile } from '~/types/project'
import type {
  Region,
  ButtonBounds,
  RegionClickHandler,
  AnnotationChangeHandler,
  ButtonClickHandler,
  MergeDirection,
  MergeAnnotationResponse
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
  const message = useMessage()
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
  const mergeLeftButtonBounds = ref<ButtonBounds | null>(null)
  const mergeRightButtonBounds = ref<ButtonBounds | null>(null)

  // 添加合并标注的处理函数
  const handleMerge = async (
    id: string,
    direction: MergeDirection,
    projectId: string,
    audioFileId: string,
    onAnnotationChangeHandler?: AnnotationChangeHandler
  ) => {
    const region = regionManager.getRegion(id)
    if (!region) return

    // 查找相邻标注
    const regions = regionManager.getAllRegions()
    let adjacentId: string | null = null
    let adjacentRegion: Region | null = null

    for (const [otherId, otherRegion] of regions.entries()) {
      if (otherId === id) continue
      if (direction === 'left' && Math.abs(otherRegion.end - region.start) < 0.01) {
        adjacentId = otherId
        adjacentRegion = otherRegion
        break
      }
      if (direction === 'right' && Math.abs(otherRegion.start - region.end) < 0.01) {
        adjacentId = otherId
        adjacentRegion = otherRegion
        break
      }
    }

    if (!adjacentId || !adjacentRegion) {
      message.warning('没有找到相邻标注')
      return
    }

    try {
      // 调用合并 API
      const response = await $fetch<MergeAnnotationResponse>('/api/annotations/merge', {
        method: 'POST',
        body: {
          projectId,
          audioFileId,
          targetId: adjacentId,  // 相邻标注作为目标
          sourceId: id,          // 当前标注作为源
          direction
        }
      })

      if (response.success && response.annotation) {
        // 更新区域
        regionManager.removeRegion(id)  // 删除源标注（当前标注）
        regionManager.updateRegion(response.annotation)  // 更新目标标注（相邻标注）
        
        // 通知外部更新标注
        if (onAnnotationChangeHandler) {
          // 通知删除源标注
          onAnnotationChangeHandler({ ...region, id, deleted: true } as any)
          // 通知更新目标标注
          onAnnotationChangeHandler(response.annotation)
        }
        
        message.success('标注已合并')
      }
    } catch (error) {
      console.error('Failed to merge annotations:', error)
      message.error('合并失败')
    }
  }

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
          {
            add: addButtonBounds.value,
            edit: editButtonBounds.value,
            delete: deleteButtonBounds.value,
            mergeLeft: mergeLeftButtonBounds.value,
            mergeRight: mergeRightButtonBounds.value
          },
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
          {
            add: addButtonBounds.value,
            edit: editButtonBounds.value,
            delete: deleteButtonBounds.value,
            mergeLeft: mergeLeftButtonBounds.value,
            mergeRight: mergeRightButtonBounds.value
          }
        )
        
        if (result) {
          if (result.type === 'hover') {
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
          // 更新内部状态但不触发保存
          regionManager.updateRegion(result.data.current)
          if (result.data.adjacent) {
            regionManager.updateRegion(result.data.adjacent)
          }
          // 触发保存
          onAnnotationChangeHandler(result.data.current)
          if (result.data.adjacent) {
            onAnnotationChangeHandler(result.data.adjacent)
          }
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
    const originalOnAddButtonClick = interactionHandler.onAddButtonClick.value
    const originalOnEditButtonClick = interactionHandler.onEditButtonClick.value
    const originalOnDeleteButtonClick = interactionHandler.onDeleteButtonClick.value
    
    
    // 只有在没有设置回调的情况下才设置默认回调
    if (!originalOnAddButtonClick) {
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
    }

    if (!originalOnEditButtonClick) {
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
    } 

    if (!originalOnDeleteButtonClick) {
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
    } 

    // 设置合并按钮回调
    interactionHandler.onMergeLeftButtonClick.value = (id) => {
      if (!id) return
      handleMerge(id, 'left', audioFile.projectId, audioFile.id, onAnnotationChangeHandler)
    }
    interactionHandler.onMergeRightButtonClick.value = (id) => {
      if (!id) return
      handleMerge(id, 'right', audioFile.projectId, audioFile.id, onAnnotationChangeHandler)
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

      // 准备按钮边界对象
      const buttonBounds = {
        add: addButtonBounds.value,
        edit: editButtonBounds.value,
        delete: deleteButtonBounds.value,
        mergeLeft: mergeLeftButtonBounds.value,
        mergeRight: mergeRightButtonBounds.value
      }

      // 绘制波形
      await waveformDrawer.drawWaveform(
        audioPlayer.duration.value,
        audioPlayer.currentTime.value,
        pixelsPerSecond.value,
        regionManager.getAllRegions(),
        interactionHandler.hoveredRegion.value,
        interactionHandler.adjacentRegion.value,
        selectionRange,
        editingAnnotation.value,
        buttonBounds
      )

      // 更新按钮边界引用
      addButtonBounds.value = buttonBounds.add ? { ...buttonBounds.add } : null
      editButtonBounds.value = buttonBounds.edit ? { ...buttonBounds.edit } : null
      deleteButtonBounds.value = buttonBounds.delete ? { ...buttonBounds.delete } : null
      mergeLeftButtonBounds.value = buttonBounds.mergeLeft ? { ...buttonBounds.mergeLeft } : null
      mergeRightButtonBounds.value = buttonBounds.mergeRight ? { ...buttonBounds.mergeRight } : null
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

  const setScrollPosition = (container: HTMLElement, targetScroll: number, retries = 0) => {
    if (retries > 5) return // 最多重试5次

    container.scrollTo({
      left: targetScroll,
      behavior: 'instant'
    })

    // 检查滚动位置是否设置成功
    setTimeout(() => {
      if (Math.abs(container.scrollLeft - targetScroll) > 1) {
        setScrollPosition(container, targetScroll, retries + 1)
      }
    }, 16) // 等待一帧的时间
  }

  // 新增：将视图居中到指定时间点的函数
  const centerViewOnTime = async (centerTime: number, newPixelsPerSecond?: number) => {
    if (!waveformDrawer.canvas.value) return
    
    // 获取正确的滚动容器
    const container = waveformDrawer.canvas.value.parentElement?.parentElement
    if (!container || !container.classList.contains('waveform-container')) return
    
    // 如果提供了新的缩放比例，更新它
    if (newPixelsPerSecond !== undefined) {
      pixelsPerSecond.value = newPixelsPerSecond
      await updateDrawing()
      await nextTick()
    }
    
    // 计算波形图尺寸和目标滚动位置
    const startTime = unref(viewport.startTime)
    const endTime = unref(viewport.endTime)
    const waveformWidth = (endTime - startTime) * pixelsPerSecond.value
    const containerWidth = container.clientWidth
    
    // 计算目标滚动位置：将指定时间点放在容器中心
    const centerTimePosition = (centerTime - startTime) * pixelsPerSecond.value + PADDING
    const targetScroll = Math.max(0, 
      Math.min(
        waveformWidth + PADDING * 2 - containerWidth,  // 最大滚动范围
        centerTimePosition - containerWidth / 2         // 指定位置居中
      )
    )
    
    // 设置滚动位置并确保成功
    setScrollPosition(container, targetScroll)
    
    // 确保画布更新
    await updateDrawing()
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
    loadingPhase: computed(() => audioPlayer.loadingPhase.value),
    loadingProgress: computed(() => audioPlayer.loadingProgress.value),
    // 添加渲染范围相关的计算属性
    viewportStartPercent: computed({
      get: () => Math.round((viewport.startTime / audioPlayer.duration.value) * 100),
      set: async (value) => {
        const newStartTime = (value / 100) * audioPlayer.duration.value
        viewport.setViewport(newStartTime, viewport.endTime)
        await updateDrawing()
        
        // 检查当前播放时间是否在视口范围内
        const currentTime = audioPlayer.currentTime.value
        if (currentTime < newStartTime) {
          // 如果在视口前面，调整到视口开始
          audioPlayer.seek(newStartTime)
          await centerViewOnTime(newStartTime)
        } else if (currentTime > viewport.endTime) {
          // 如果在视口后面，调整到视口结束
          audioPlayer.seek(viewport.endTime)
          await centerViewOnTime(viewport.endTime)
        } else {
          // 如果在视口内，居中到当前播放位置
          await centerViewOnTime(currentTime)
        }
      }
    }),
    viewportEndPercent: computed({
      get: () => Math.round((viewport.endTime / audioPlayer.duration.value) * 100),
      set: async (value) => {
        const newEndTime = (value / 100) * audioPlayer.duration.value
        viewport.setViewport(viewport.startTime, newEndTime)
        await updateDrawing()
        
        // 检查当前播放时间是否在视口范围内
        const currentTime = audioPlayer.currentTime.value
        if (currentTime < viewport.startTime) {
          // 如果在视口前面，调整到视口开始
          audioPlayer.seek(viewport.startTime)
          await centerViewOnTime(viewport.startTime)
        } else if (currentTime > newEndTime) {
          // 如果在视口后面，调整到视口结束
          audioPlayer.seek(newEndTime)
          await centerViewOnTime(newEndTime)
        } else {
          // 如果在视口内，居中到当前播放位置
          await centerViewOnTime(currentTime)
        }
      }
    }),
    maxStartPercent: computed(() => {
      const endPercent = Math.round((viewport.endTime / audioPlayer.duration.value) * 100)
      return Math.min(endPercent - 1, 99)
    }),
    minEndPercent: computed(() => {
      const startPercent = Math.round((viewport.startTime / audioPlayer.duration.value) * 100)
      return Math.max(startPercent + 1, 1)
    }),

    // 方法
    initialize,
    destroy,
    playPause: audioPlayer.playPause,
    seek: audioPlayer.seek,
    zoomIn: async () => {
      const oldPixelsPerSecond = pixelsPerSecond.value
      const newPixelsPerSecond = Math.min(oldPixelsPerSecond * 1.5, 1000)
      await centerViewOnTime(audioPlayer.currentTime.value, newPixelsPerSecond)
    },
    zoomOut: async () => {
      const oldPixelsPerSecond = pixelsPerSecond.value
      const newPixelsPerSecond = Math.max(oldPixelsPerSecond / 1.5, 10)
      await centerViewOnTime(audioPlayer.currentTime.value, newPixelsPerSecond)
    },
    centerViewOnTime,
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
    onMergeLeftButtonClick: interactionHandler.onMergeLeftButtonClick,
    onMergeRightButtonClick: interactionHandler.onMergeRightButtonClick,
    handleMerge,
    updateDrawing
  }
} 