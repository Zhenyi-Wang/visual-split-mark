import { ref } from 'vue'
import type { AudioFile } from '~/types/project'
import { loadBlob } from '~/utils/file'
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
  HANDLE_VISUAL_SIZE,
  BUTTON_SIZE,
  BUTTON_PADDING,
  BUTTON_GAP,
  DEFAULT_PIXELS_PER_SECOND,
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  COLORS
} from '~/constants/visualizer'
import {
  formatTimeAxis,
  getTimeFromY,
  getYFromTime,
  formatPlayTime
} from '~/utils/timeFormat'

export function useAudioVisualizer() {
  const audioContext = ref<AudioContext | null>(null)
  const audioElement = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const pixelsPerSecond = ref(DEFAULT_PIXELS_PER_SECOND)
  const playbackRate = ref(1)
  let animationFrame: number | null = null
  let canvasCtx: CanvasRenderingContext2D | null = null
  let canvas: HTMLCanvasElement | null = null
  let channelData: Float32Array | null = null
  const isDragging = ref(false)
  const selectionStart = ref<number | null>(null)
  const selectionEnd = ref<number | null>(null)
  const selectedRegion = ref<{ start: number; end: number } | null>(null)
  const regions = ref<Map<string, { start: number; end: number; text?: string }>>(new Map())
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

  // 绘制圆形按钮的辅助函数
  const drawCircleButton = (x: number, y: number, size: number, color: string, icon: 'add' | 'edit' | 'delete') => {
    if (!canvasCtx) return

    // 绘制按钮背景
    const centerX = x + size/2
    const centerY = y + size/2
    canvasCtx.fillStyle = color
    canvasCtx.beginPath()
    canvasCtx.arc(centerX, centerY, size/2, 0, Math.PI * 2)
    canvasCtx.fill()

    // 绘制图标
    canvasCtx.strokeStyle = '#fff'
    canvasCtx.lineWidth = 2
    canvasCtx.beginPath()

    const iconSize = size * 0.4 // 图标大小为按钮的 40%

    if (icon === 'add') {
      // 绘制加号
      canvasCtx.moveTo(centerX - iconSize/2, centerY)
      canvasCtx.lineTo(centerX + iconSize/2, centerY)
      canvasCtx.moveTo(centerX, centerY - iconSize/2)
      canvasCtx.lineTo(centerX, centerY + iconSize/2)
    } else if (icon === 'edit') {
      // 绘制编辑图标（铅笔）
      canvasCtx.moveTo(centerX - iconSize/2, centerY + iconSize/2)
      canvasCtx.lineTo(centerX + iconSize/2, centerY - iconSize/2)
      canvasCtx.moveTo(centerX - iconSize/2, centerY + iconSize/2)
      canvasCtx.lineTo(centerX - iconSize/3, centerY + iconSize/2)
    } else if (icon === 'delete') {
      // 绘制删除图标（X）
      canvasCtx.moveTo(centerX - iconSize/2, centerY - iconSize/2)
      canvasCtx.lineTo(centerX + iconSize/2, centerY + iconSize/2)
      canvasCtx.moveTo(centerX + iconSize/2, centerY - iconSize/2)
      canvasCtx.lineTo(centerX - iconSize/2, centerY + iconSize/2)
    }
    canvasCtx.stroke()
  }

  const drawWaveform = () => {
    if (!canvasCtx || !canvas || !channelData || !duration.value) return

    // 根据缩放比例计算总高度
    const totalHeight = duration.value * pixelsPerSecond.value + PADDING * 2
    
    // 同时设置 Canvas 的实际像素高度和 CSS 样式高度
    canvas.height = totalHeight
    canvas.style.height = `${totalHeight}px`

    const annotationWidth = canvas.width - TIME_AXIS_WIDTH - WAVEFORM_WIDTH // 标注区域宽度

    // 清除画布
    canvasCtx.fillStyle = '#fff'
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制时间轴背景
    canvasCtx.fillStyle = COLORS.timeAxis.background
    canvasCtx.fillRect(0, 0, TIME_AXIS_WIDTH, canvas.height)

    // 绘制波形区域背景
    canvasCtx.fillStyle = '#fff'
    canvasCtx.fillRect(TIME_AXIS_WIDTH, 0, WAVEFORM_WIDTH, canvas.height)

    // 绘制标注区域背景
    canvasCtx.fillStyle = '#fff'
    canvasCtx.fillRect(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, 0, annotationWidth, canvas.height)

    // 绘制分隔线
    canvasCtx.beginPath()
    canvasCtx.strokeStyle = '#ccc'
    canvasCtx.lineWidth = 1
    // 时间轴分隔线
    canvasCtx.moveTo(TIME_AXIS_WIDTH, 0)
    canvasCtx.lineTo(TIME_AXIS_WIDTH, canvas.height)
    // 波形区域分隔线
    canvasCtx.moveTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, 0)
    canvasCtx.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, canvas.height)
    canvasCtx.stroke()

    const barWidth = 1
    const barGap = 1
    const totalBars = Math.floor((totalHeight - PADDING * 2) / (barWidth + barGap))
    const samplesPerBar = Math.floor(channelData.length / totalBars)

    // 计算时间间隔
    const pixelsPerMinute = pixelsPerSecond.value * 60
    const minuteHeight = pixelsPerMinute // 每分钟的像素高度
    const totalMinutes = Math.ceil(duration.value / 60)
    
    // 根据缩放级别选择合适的时间间隔（秒）
    let timeInterval = 30 // 默认30秒
    let minorInterval = 5 // 次要刻度的间隔（秒）
    if (pixelsPerSecond.value >= 30) {
      timeInterval = 1 // 1秒
      minorInterval = 0.2 // 0.2秒
    }
    else if (pixelsPerSecond.value >= 15) {
      timeInterval = 2 // 2秒
      minorInterval = 0.5 // 0.5秒
    }
    else if (pixelsPerSecond.value >= 10) {
      timeInterval = 5 // 5秒
      minorInterval = 1 // 1秒
    }
    else if (pixelsPerSecond.value >= 5) {
      timeInterval = 10 // 10秒
      minorInterval = 2 // 2秒
    }
    else if (pixelsPerSecond.value >= 2) {
      timeInterval = 15 // 15秒
      minorInterval = 3 // 3秒
    }
    else if (pixelsPerMinute >= 60) {
      timeInterval = 30 // 30秒
      minorInterval = 5 // 5秒
    }
    else if (pixelsPerMinute >= 30) {
      timeInterval = 60 // 1分钟
      minorInterval = 10 // 10秒
    }
    else if (pixelsPerMinute >= 15) {
      timeInterval = 300 // 5分钟
      minorInterval = 60 // 1分钟
    }
    else if (pixelsPerMinute >= 8) {
      timeInterval = 600 // 10分钟
      minorInterval = 120 // 2分钟
    }
    else {
      timeInterval = 1800 // 30分钟
      minorInterval = 300 // 5分钟
    }

    // 绘制时间刻度和文本
    canvasCtx.beginPath()
    canvasCtx.strokeStyle = COLORS.timeAxis.line.secondary
    canvasCtx.fillStyle = COLORS.text.secondary
    canvasCtx.font = '12px Arial'
    canvasCtx.textAlign = 'right'
    canvasCtx.textBaseline = 'middle'

    // 计算总秒数
    const totalSeconds = Math.ceil(duration.value)
    
    // 先绘制次要刻度
    canvasCtx.beginPath()
    canvasCtx.strokeStyle = COLORS.timeAxis.line.secondary
    canvasCtx.lineWidth = 1
    for (let second = 0; second <= totalSeconds; second += minorInterval) {
      const y = getYFromTime(second, canvas!, duration.value)
      canvasCtx.moveTo(TIME_AXIS_WIDTH - 4, y)
      canvasCtx.lineTo(TIME_AXIS_WIDTH, y)
    }
    canvasCtx.stroke()

    // 绘制主要刻度和文本
    canvasCtx.beginPath()
    canvasCtx.strokeStyle = COLORS.timeAxis.line.primary
    canvasCtx.lineWidth = 1.5
    canvasCtx.fillStyle = COLORS.text.primary
    canvasCtx.font = '12px Arial'
    canvasCtx.textAlign = 'right'
    canvasCtx.textBaseline = 'middle'

    for (let second = 0; second <= totalSeconds; second += timeInterval) {
      const y = getYFromTime(second, canvas!, duration.value)
      
      // 根据时间间隔决定刻度线长度
      const isMainTick = second % 60 === 0 // 整分钟为主刻度
      const tickLength = isMainTick ? 12 : 8
      
      // 绘制刻度线
      canvasCtx.moveTo(TIME_AXIS_WIDTH - tickLength, y)
      canvasCtx.lineTo(TIME_AXIS_WIDTH, y)
      
      // 绘制时间文本
      if (isMainTick || timeInterval < 60) {
        const timeText = formatTimeAxis(second)
        canvasCtx.fillText(timeText, TIME_AXIS_WIDTH - (tickLength + 8), y)
      }
    }
    canvasCtx.stroke()

    // 修改波形绘制范围
    canvasCtx.fillStyle = COLORS.waveform
    for (let i = 0; i < totalBars; i++) {
      const startSample = i * samplesPerBar
      const endSample = startSample + samplesPerBar
      let max = 0

      for (let j = startSample; j < endSample; j++) {
        const amplitude = Math.abs(channelData[j])
        if (amplitude > max) {
          max = amplitude
        }
      }

      const barHeight = max * WAVEFORM_WIDTH * 0.8
      const x = TIME_AXIS_WIDTH + (WAVEFORM_WIDTH - barHeight) / 2
      const y = i * (barWidth + barGap) + PADDING

      canvasCtx.fillRect(x, y, barHeight, barWidth)
    }

    // 修改进度线范围
    if (audioElement.value) {
      const progress = audioElement.value.currentTime / duration.value
      const progressY = getYFromTime(audioElement.value.currentTime, canvas!, duration.value)

      canvasCtx.beginPath()
      canvasCtx.strokeStyle = COLORS.progress
      canvasCtx.lineWidth = 2
      canvasCtx.moveTo(TIME_AXIS_WIDTH, progressY)
      canvasCtx.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, progressY)
      canvasCtx.stroke()
    }

    // 修改标注区域绘制
    regions.value.forEach((region, id) => {
      const startY = getYFromTime(region.start, canvas!, duration.value)
      const endY = getYFromTime(region.end, canvas!, duration.value)
      const isHovered = hoveredRegion.value?.id === id

      // 绘制波形区域的标注背景
      canvasCtx!.fillStyle = isHovered ? COLORS.region.fill.hover : COLORS.region.fill.normal
      canvasCtx!.fillRect(TIME_AXIS_WIDTH, Math.min(startY, endY), WAVEFORM_WIDTH, Math.abs(endY - startY))

      // 如果是当前选中的标注，绘制编辑和删除按钮
      if (isHovered && canvas && canvasCtx) {
        const buttonY = Math.min(startY, endY) + BUTTON_PADDING

        // 绘制删除按钮（在最右边）
        const deleteButtonX = canvas.width - BUTTON_SIZE - BUTTON_PADDING
        drawCircleButton(deleteButtonX, buttonY, BUTTON_SIZE, COLORS.button.delete, 'delete')
        
        // 计算删除按钮的点击判定区域
        deleteButtonBounds.value = {
          x: deleteButtonX,
          y: buttonY,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE
        }

        // 绘制编辑按钮（在删除按钮左边）
        const editButtonX = deleteButtonX - BUTTON_SIZE - BUTTON_GAP
        drawCircleButton(editButtonX, buttonY, BUTTON_SIZE, COLORS.button.edit, 'edit')
        
        // 计算编辑按钮的点击判定区域
        editButtonBounds.value = {
          x: editButtonX,
          y: buttonY,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE
        }
      }

      // 绘制波形区域的标注边界线
      canvasCtx!.beginPath()
      canvasCtx!.strokeStyle = isHovered ? COLORS.region.border.hover : COLORS.region.border.normal
      canvasCtx!.lineWidth = isHovered ? 2 : 1
      canvasCtx!.moveTo(TIME_AXIS_WIDTH, startY)
      canvasCtx!.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, startY)
      canvasCtx!.moveTo(TIME_AXIS_WIDTH, endY)
      canvasCtx!.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, endY)
      canvasCtx!.stroke()

      // 在标注区域绘制文本
      const text = region.text || ''
      canvasCtx!.font = '14px Arial'
      canvasCtx!.textBaseline = 'top'
      
      // 计算文本显示位置
      const textY = Math.min(startY, endY)
      const textX = TIME_AXIS_WIDTH + WAVEFORM_WIDTH + 16 // 标注区域左边距
      
      // 绘制标注区域的背景
      canvasCtx!.fillStyle = isHovered ? COLORS.region.fill.hover : COLORS.region.fill.normal
      canvasCtx!.fillRect(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, Math.min(startY, endY), annotationWidth, Math.abs(endY - startY))

      // 绘制文本
      canvasCtx!.fillStyle = COLORS.text.primary
      canvasCtx!.textAlign = 'left'
      
      // 文本换行处理
      const maxWidth = annotationWidth - 32 // 左右各留16px边距
      const words = text.split('')
      let line = ''
      let lines: string[] = []
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n]
        const metrics = canvasCtx!.measureText(testLine)
        if (metrics.width > maxWidth && n > 0) {
          lines.push(line)
          line = words[n]
        } else {
          line = testLine
        }
      }
      lines.push(line)

      // 绘制多行文本
      const lineHeight = 20
      const startTextY = textY + 8 // 添加 8px 的上边距
      
      lines.forEach((line, index) => {
        canvasCtx!.fillText(line, textX, startTextY + index * lineHeight)
      })
    })

    // 修改选区绘制范围
    if (selectionStart.value !== null && selectionEnd.value !== null) {
      const startY = getYFromTime(selectionStart.value, canvas!, duration.value)
      const endY = getYFromTime(selectionEnd.value, canvas!, duration.value)

      canvasCtx.fillStyle = COLORS.selection.fill
      canvasCtx.fillRect(TIME_AXIS_WIDTH, Math.min(startY, endY), WAVEFORM_WIDTH, Math.abs(endY - startY))

      canvasCtx.beginPath()
      canvasCtx.strokeStyle = COLORS.selection.border
      canvasCtx.lineWidth = 2
      canvasCtx.moveTo(TIME_AXIS_WIDTH, startY)
      canvasCtx.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, startY)
      canvasCtx.moveTo(TIME_AXIS_WIDTH, endY)
      canvasCtx.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, endY)
      canvasCtx.stroke()

      // 绘制添加按钮
      const buttonX = TIME_AXIS_WIDTH + WAVEFORM_WIDTH - BUTTON_SIZE - BUTTON_PADDING
      const buttonY = Math.min(startY, endY) + BUTTON_PADDING
      
      drawCircleButton(buttonX, buttonY, BUTTON_SIZE, COLORS.button.add, 'add')

      // 存储按钮区域信息，用于点击检测
      addButtonBounds.value = {
        x: buttonX,
        y: buttonY,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE
      }
    } else {
      addButtonBounds.value = null
    }
  }

  // 格式化时间轴显示
  const formatTimeAxis = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    }
    // 当时间间隔小于1分钟时，显示秒
    if (remainingSeconds > 0) {
      return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
    }
    return `${minutes}:00`
  }

  // 检查点击位置是否在标注区域内
  const findRegionAtPosition = (y: number, x: number): RegionInfo | null => {
    if (!canvas || !duration.value) return null
    
    // 排除时间轴区域的点击
    if (y < PADDING || y > canvas.height - PADDING) return null
    
    // 计算时间点
    const time = getTimeFromY(y, canvas!, duration.value)
    if (time === null) return null

    // 查找包含该时间点的区域
    for (const [id, region] of regions.value.entries()) {
      const startY = getYFromTime(region.start, canvas!, duration.value)
      const endY = getYFromTime(region.end, canvas!, duration.value)
      
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

  const initialize = async (
    container: HTMLElement, 
    audioFile: AudioFile, 
    onRegionClickHandler?: RegionClickHandler,
    onAnnotationChangeHandler?: AnnotationChangeHandler
  ) => {
    // 创建音频元素
    audioElement.value = new Audio()
    audioElement.value.crossOrigin = 'anonymous'
    
    // 加载音频文件
    const blob = await loadBlob(audioFile.wavPath)
    if (!blob) {
      throw new Error('Failed to load audio file')
    }
    const arrayBuffer = await blob.arrayBuffer()
    
    // 创建音频上下文
    audioContext.value = new AudioContext()
    
    // 解码音频数据
    const audioBuffer = await audioContext.value.decodeAudioData(arrayBuffer)
    duration.value = audioBuffer.duration
    
    // 获取波形数据
    channelData = audioBuffer.getChannelData(0)
    
    // 创建 Canvas 元素
    canvas = document.createElement('canvas')
    canvas.className = 'vertical-waveform'
    canvas.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: ${duration.value * pixelsPerSecond.value + PADDING * 2}px;
      background: #fff;
      border-radius: 4px;
    `
    canvas.width = container.clientWidth
    canvas.height = duration.value * pixelsPerSecond.value + PADDING * 2
    
    // 添加到容器
    container.appendChild(canvas)
    
    // 获取绘图上下文
    canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) {
      throw new Error('Failed to get canvas context')
    }

    // 绘制初始波形
    drawWaveform()

    // 设置回调函数
    onRegionClick.value = onRegionClickHandler || null
    onAnnotationChange.value = onAnnotationChangeHandler || null

    // 添加鼠标事件
    let clickStartTime = 0
    const CLICK_THRESHOLD = 200 // 判断点击的时间阈值

    canvas.addEventListener('mousedown', (e) => {
      if (!canvas) return
      clickStartTime = Date.now()
      const rect = canvas.getBoundingClientRect()
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
        const time = getTimeFromY(y, canvas!, duration.value)
        if (time === null) return
        isDragging.value = true
        selectionStart.value = time
        selectionEnd.value = time
        selectedRegion.value = null
        drawWaveform()
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
        seek(region.start)
      }
    })

    canvas.addEventListener('mousemove', (e) => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const y = e.clientY - rect.top + container.scrollTop
      const x = e.clientX - rect.left
      const time = getTimeFromY(y, canvas!, duration.value)
      if (time === null) return

      // 检查是否在按钮上
      let isOnButton = false

      // 检查编辑和删除按钮（仅在有悬停区域时）
      if (hoveredRegion.value) {
        // 检查编辑按钮
        if (editButtonBounds.value) {
          const { x: bx, y: by, width: bw, height: bh } = editButtonBounds.value
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
            canvas.style.cursor = 'pointer'
            isOnButton = true
          }
        }
        
        // 检查删除按钮
        if (!isOnButton && deleteButtonBounds.value) {
          const { x: bx, y: by, width: bw, height: bh } = deleteButtonBounds.value
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
            canvas.style.cursor = 'pointer'
            isOnButton = true
          }
        }
      }

      // 检查添加按钮（仅在有选区时）
      if (!isOnButton && selectionStart.value !== null && selectionEnd.value !== null && addButtonBounds.value) {
        const { x: bx, y: by, width: bw, height: bh } = addButtonBounds.value
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
          for (const [id, region] of regions.value.entries()) {
            const startY = (region.start / duration.value) * (canvas.height - PADDING * 2) + PADDING
            const endY = (region.end / duration.value) * (canvas.height - PADDING * 2) + PADDING
            
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
        updateRegion(newAnnotation)
        drawWaveform()
      } else if (isDragging.value) {
        // 更新选区
        selectionEnd.value = time
        drawWaveform()
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
        drawWaveform()
      }
    })

    canvas.addEventListener('mouseup', (e: MouseEvent) => {
      if (isDraggingAnnotation.value && editingAnnotation.value) {
        // 在拖拽结束时触发更新回调
        if (onAnnotationChangeHandler) {
          onAnnotationChangeHandler(editingAnnotation.value)
        }
      }
      isDraggingAnnotation.value = false
      draggingHandle.value = null
      if (!canvas || !isDragging.value) return
      
      const clickDuration = Date.now() - clickStartTime
      const rect = canvas.getBoundingClientRect()
      const y = e.clientY - rect.top + container.scrollTop
      const time = getTimeFromY(y, canvas!, duration.value)
      
      isDragging.value = false
      
      if (clickDuration < CLICK_THRESHOLD && selectionStart.value !== null && Math.abs(selectionStart.value - (time || 0)) < 0.1) {
        // 这是一个点击事件
        selectionStart.value = null
        selectionEnd.value = null
        selectedRegion.value = null
        seek(time || 0)
      } else if (selectionStart.value !== null && time !== null) {
        // 这是一个拖拽事件
        selectedRegion.value = {
          start: Math.min(selectionStart.value, time),
          end: Math.max(selectionStart.value, time)
        }
      }
      
      drawWaveform()
    })

    // 添加鼠标离开事件处理
    canvas.addEventListener('mouseleave', () => {
      if (!canvas) return
      canvas.style.cursor = 'default'
      hoveredRegion.value = null
      if (isDragging.value) {
        isDragging.value = false
      }
      drawWaveform()
    })
    
    // 创建音频源并连接
    audioElement.value.src = URL.createObjectURL(blob)
    const source = audioContext.value.createMediaElementSource(audioElement.value)
    source.connect(audioContext.value.destination)
    
    // 添加音频事件监听
    audioElement.value.addEventListener('play', () => {
      isPlaying.value = true
    })
    
    audioElement.value.addEventListener('pause', () => {
      isPlaying.value = false
    })
    
    audioElement.value.addEventListener('timeupdate', () => {
      currentTime.value = audioElement.value?.currentTime || 0
      
      // 计算当前播放位置对应的 Y 坐标
      const currentY = (currentTime.value / duration.value) * (canvas!.height - PADDING * 2) + PADDING
      
      // 获取容器的可视区域高度
      const containerHeight = container.clientHeight
      
      // 计算滚动位置，使播放位置保持在视图中间
      const targetScrollTop = currentY - containerHeight / 2
      
      // 平滑滚动到目标位置
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      })
      
      drawWaveform()
    })

    // 添加窗口大小变化监听
    const handleResize = () => {
      if (!canvas || !container) return
      canvas.width = container.clientWidth
      drawWaveform()
    }
    
    window.addEventListener('resize', handleResize)
    
    // 将 handleResize 保存到组件实例上，以便在 destroy 时移除
    ;(canvas as any)._resizeHandler = handleResize
  }

  const setZoom = (value: number) => {
    const minZoom = 1 // 最小缩放为 1px/s
    pixelsPerSecond.value = Math.max(minZoom, Math.min(500, value))
    if (canvas) {
      drawWaveform()
    }
  }

  const zoomIn = () => {
    setZoom(pixelsPerSecond.value * 1.2)
  }

  const zoomOut = () => {
    setZoom(pixelsPerSecond.value / 1.2)
  }

  const destroy = () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
    if (audioContext.value) {
      audioContext.value.close()
    }
    if (audioElement.value) {
      audioElement.value.pause()
      audioElement.value.src = ''
    }
    if (canvas) {
      // 移除 resize 事件监听
      window.removeEventListener('resize', (canvas as any)._resizeHandler)
      canvas.remove()
      canvas = null
    }
    canvasCtx = null
    channelData = null
    isPlaying.value = false
    duration.value = 0
    currentTime.value = 0
  }

  const playPause = async () => {
    if (!audioElement.value || !audioContext.value) return

    // 如果音频上下文被挂起，则恢复
    if (audioContext.value.state === 'suspended') {
      await audioContext.value.resume()
    }

    if (isPlaying.value) {
      audioElement.value.pause()
    } else {
      await audioElement.value.play()
    }
  }

  const seek = (time: number) => {
    if (!audioElement.value) return
    audioElement.value.currentTime = Math.max(0, Math.min(time, duration.value))
  }

  // 绘制选中区域
  const drawSelection = () => {
    if (!canvasCtx || !canvas || !selectionStart.value || !selectionEnd.value) return

    const timeAxisWidth = 50
    const padding = 30
    const startY = (selectionStart.value / duration.value) * (canvas.height - padding * 2) + padding
    const endY = (selectionEnd.value / duration.value) * (canvas.height - padding * 2) + padding

    // 绘制半透明遮罩
    canvasCtx.fillStyle = 'rgba(74, 158, 255, 0.2)'
    canvasCtx.fillRect(timeAxisWidth, Math.min(startY, endY), canvas.width - timeAxisWidth, Math.abs(endY - startY))

    // 绘制边界线
    canvasCtx.beginPath()
    canvasCtx.strokeStyle = '#4a9eff'
    canvasCtx.lineWidth = 2
    canvasCtx.moveTo(timeAxisWidth, startY)
    canvasCtx.lineTo(canvas.width, startY)
    canvasCtx.moveTo(timeAxisWidth, endY)
    canvasCtx.lineTo(canvas.width, endY)
    canvasCtx.stroke()
  }

  // 添加标注区域
  const addRegion = (annotation: { id: string; start: number; end: number; text?: string }) => {
    regions.value.set(annotation.id, {
      start: annotation.start,
      end: annotation.end,
      text: annotation.text
    })
    drawWaveform()
  }

  // 更新标注区域
  const updateRegion = (annotation: { id: string; start: number; end: number; text?: string }) => {
    regions.value.set(annotation.id, {
      start: annotation.start,
      end: annotation.end,
      text: annotation.text
    })
    drawWaveform()
  }

  // 删除标注区域
  const removeRegion = (id: string) => {
    regions.value.delete(id)
    drawWaveform()
  }

  // 绘制所有标注区域
  const drawRegions = () => {
    if (!canvasCtx || !canvas) return

    regions.value.forEach((region, id) => {
      if (!canvasCtx || !canvas) return

      const startY = (region.start / duration.value) * (canvas.height - PADDING * 2) + PADDING
      const endY = (region.end / duration.value) * (canvas.height - PADDING * 2) + PADDING
      const isEditing = editingAnnotation.value?.id === id
      const isHovered = hoveredRegion.value?.id === id

      // 绘制波形区域的标注背景
      canvasCtx.fillStyle = isEditing ? 'rgba(255, 182, 193, 0.4)' : (isHovered ? 'rgba(255, 182, 193, 0.3)' : 'rgba(255, 182, 193, 0.2)')
      canvasCtx.fillRect(TIME_AXIS_WIDTH, Math.min(startY, endY), WAVEFORM_WIDTH, Math.abs(endY - startY))

      // 绘制波形区域的标注边界线
      canvasCtx.beginPath()
      canvasCtx.strokeStyle = isEditing ? '#ff1493' : (isHovered ? '#ff69b4' : '#ffb6c1')
      canvasCtx.lineWidth = isEditing ? 2 : 1

      // 绘制开始和结束线
      canvasCtx.moveTo(TIME_AXIS_WIDTH, startY)
      canvasCtx.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, startY)
      canvasCtx.moveTo(TIME_AXIS_WIDTH, endY)
      canvasCtx.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, endY)
      canvasCtx.stroke()

      // 绘制拖拽手柄
      if (isEditing || isHovered) {
        canvasCtx.fillStyle = '#ff1493'
        // 开始时间手柄
        canvasCtx.beginPath()
        canvasCtx.arc(TIME_AXIS_WIDTH + WAVEFORM_WIDTH / 2, startY, HANDLE_VISUAL_SIZE, 0, Math.PI * 2)
        canvasCtx.fill()
        // 结束时间手柄
        canvasCtx.beginPath()
        canvasCtx.arc(TIME_AXIS_WIDTH + WAVEFORM_WIDTH / 2, endY, HANDLE_VISUAL_SIZE, 0, Math.PI * 2)
        canvasCtx.fill()
      }

      // 绘制标注文本背景
      const text = region.text || ''
      canvasCtx.font = '14px Arial'
      canvasCtx.textBaseline = 'middle'
      
      // 计算文本显示位置
      const textY = (startY + endY) / 2
      const textX = TIME_AXIS_WIDTH + WAVEFORM_WIDTH + 16 // 标注区域左边距
      
      // 绘制文本背景
      canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      const textMetrics = canvasCtx.measureText(text)
      const textHeight = 24
      const textWidth = Math.min(textMetrics.width + WAVEFORM_WIDTH + 16, WAVEFORM_WIDTH)
      canvasCtx.fillRect(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, Math.min(startY, endY), textWidth, textHeight)

      // 绘制文本
      canvasCtx.fillStyle = '#333'
      canvasCtx.textAlign = 'left'
      
      // 如果文本过长，截断并添加省略号
      let displayText = text
      if (textMetrics.width > WAVEFORM_WIDTH - 16) {
        let tempText = text
        while (canvasCtx.measureText(tempText + '...').width > WAVEFORM_WIDTH - 16 && tempText.length > 0) {
          tempText = tempText.slice(0, -1)
        }
        displayText = tempText + '...'
      }
      
      canvasCtx.fillText(displayText, TIME_AXIS_WIDTH + WAVEFORM_WIDTH + 16, textY)
    })
  }

  // 添加清除所有标注的方法
  const clearRegions = () => {
    regions.value.clear()
    drawWaveform()
  }

  const setPlaybackRate = (rate: number) => {
    if (!audioElement.value) return
    // 限制倍速范围在 0.5-5 倍之间
    const newRate = Math.max(0.5, Math.min(5, rate))
    playbackRate.value = newRate
    audioElement.value.playbackRate = newRate
  }

  const getPlaybackRate = () => {
    return playbackRate.value
  }

  onUnmounted(() => {
    destroy()
  })

  return {
    isPlaying,
    duration,
    currentTime,
    pixelsPerSecond,
    selectedRegion,
    editingAnnotation,
    regions, // 导出 regions
    playbackRate, // 导出倍速状态
    initialize,
    destroy,
    playPause,
    seek,
    zoomIn,
    zoomOut,
    setZoom,
    addRegion,
    updateRegion,
    removeRegion,
    clearRegions, // 导出清除方法
    hoveredRegion,
    setPlaybackRate, // 导出设置倍速方法
    getPlaybackRate, // 导出获取倍速方法
    onAddButtonClick,
    onEditButtonClick,
    onDeleteButtonClick,
  }
} 