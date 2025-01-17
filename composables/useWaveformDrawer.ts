import { ref } from 'vue'
import type { WaveformDrawer, Region } from '~/types/audio'
import {
  PADDING,
  TIME_AXIS_WIDTH,
  WAVEFORM_WIDTH,
  HANDLE_SIZE,
  HANDLE_VISUAL_SIZE,
  BUTTON_SIZE,
  BUTTON_PADDING,
  BUTTON_GAP,
  COLORS,
  TIME_AXIS_HEIGHT,
  WAVEFORM_HEIGHT,
  ANNOTATION_HEIGHT,
  TOTAL_HEIGHT
} from '~/constants/visualizer'
import { formatTimeAxis, getYFromTime, getXFromTime } from '~/utils/timeFormat'

export const useWaveformDrawer = () => {
  // 初始化 canvas 和上下文
  const canvas = ref<HTMLCanvasElement | null>(null)
  const canvasCtx = ref<CanvasRenderingContext2D | null>(null)
  const channelData = ref<Float32Array | null>(null)
  const container = ref<HTMLElement | null>(null)

  // 绘制圆形按钮
  const drawButton = (x: number, y: number, size: number, color: string) => {
    if (!canvasCtx.value) return

    canvasCtx.value.beginPath()
    canvasCtx.value.fillStyle = color
    canvasCtx.value.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
    canvasCtx.value.fill()
  }

  // 绘制编辑图标
  const drawEditIcon = (x: number, y: number, size: number) => {
    if (!canvasCtx.value) return

    const iconSize = size * 0.5
    const startX = x + (size - iconSize) / 2
    const startY = y + (size - iconSize) / 2

    canvasCtx.value.strokeStyle = '#fff'
    canvasCtx.value.lineWidth = 2
    canvasCtx.value.beginPath()
    canvasCtx.value.moveTo(startX, startY + iconSize)
    canvasCtx.value.lineTo(startX + iconSize, startY)
    canvasCtx.value.stroke()
  }

  // 绘制删除图标
  const drawDeleteIcon = (x: number, y: number, size: number) => {
    if (!canvasCtx.value) return

    const iconSize = size * 0.5
    const startX = x + (size - iconSize) / 2
    const startY = y + (size - iconSize) / 2

    canvasCtx.value.strokeStyle = '#fff'
    canvasCtx.value.lineWidth = 2
    canvasCtx.value.beginPath()
    canvasCtx.value.moveTo(startX, startY)
    canvasCtx.value.lineTo(startX + iconSize, startY + iconSize)
    canvasCtx.value.moveTo(startX + iconSize, startY)
    canvasCtx.value.lineTo(startX, startY + iconSize)
    canvasCtx.value.stroke()
  }

  // 绘制添加图标
  const drawAddIcon = (x: number, y: number, size: number) => {
    if (!canvasCtx.value) return

    const iconSize = size * 0.5
    const startX = x + (size - iconSize) / 2
    const startY = y + (size - iconSize) / 2
    const centerX = startX + iconSize / 2
    const centerY = startY + iconSize / 2

    canvasCtx.value.strokeStyle = '#fff'
    canvasCtx.value.lineWidth = 2
    canvasCtx.value.beginPath()
    canvasCtx.value.moveTo(startX, centerY)
    canvasCtx.value.lineTo(startX + iconSize, centerY)
    canvasCtx.value.moveTo(centerX, startY)
    canvasCtx.value.lineTo(centerX, startY + iconSize)
    canvasCtx.value.stroke()
  }

  // 绘制波形
  const drawWaveform = (
    duration: number,
    currentTime: number | null,
    pixelsPerSecond: number,
    regions: Map<string, Region>,
    hoveredRegion: { id: string } | null,
    selectionRange: { start: number; end: number } | null,
    editingAnnotation: { id: string } | null,
    buttonBounds: {
      add: { x: number; y: number; width: number; height: number } | null;
      edit: { x: number; y: number; width: number; height: number } | null;
      delete: { x: number; y: number; width: number; height: number } | null;
    }
  ) => {
    if (!canvasCtx.value || !canvas.value || !channelData.value || !container.value) return

    // 根据缩放比例计算总宽度
    const totalWidth = duration * pixelsPerSecond + PADDING * 2
    const actualWidth = Math.max(totalWidth, container.value.clientWidth)
    
    // 设置 Canvas 的尺寸
    canvas.value.width = actualWidth
    canvas.value.height = container.value.clientHeight
    canvas.value.style.width = `${actualWidth}px`
    canvas.value.style.height = `${container.value.clientHeight}px`

    // 计算各区域高度
    const timeAxisHeight = TIME_AXIS_HEIGHT // 固定40px
    const waveformHeight = WAVEFORM_HEIGHT // 固定200px
    const annotationHeight = canvas.value.height - timeAxisHeight - waveformHeight // 剩余全部用于标注区域

    // 清除画布
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(0, 0, canvas.value.width, canvas.value.height)

    // 绘制时间轴
    drawTimeAxis(duration, pixelsPerSecond)

    // 绘制波形区域背景
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(
      PADDING,
      timeAxisHeight,
      canvas.value.width - PADDING * 2,
      waveformHeight
    )

    // 绘制标注区域背景
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(
      PADDING,
      timeAxisHeight + waveformHeight,
      canvas.value.width - PADDING * 2,
      annotationHeight
    )

    // 绘制分隔线
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = '#ccc'
    canvasCtx.value.lineWidth = 1
    // 波形区域和标注区域的分隔线
    canvasCtx.value.moveTo(PADDING, timeAxisHeight + waveformHeight)
    canvasCtx.value.lineTo(canvas.value.width - PADDING, timeAxisHeight + waveformHeight)
    canvasCtx.value.stroke()

    // 绘制波形
    const barWidth = 1
    const barGap = 1
    const totalBars = Math.floor((canvas.value.width - PADDING * 2) / (barWidth + barGap))
    const samplesPerBar = Math.floor(channelData.value.length / totalBars)

    canvasCtx.value.fillStyle = COLORS.waveform
    for (let i = 0; i < totalBars; i++) {
      const startSample = i * samplesPerBar
      const endSample = startSample + samplesPerBar
      let max = 0

      for (let j = startSample; j < endSample; j++) {
        const amplitude = Math.abs(channelData.value[j])
        if (amplitude > max) {
          max = amplitude
        }
      }

      const barHeight = max * waveformHeight * 0.8
      const x = i * (barWidth + barGap) + PADDING
      const y = timeAxisHeight + (waveformHeight - barHeight) / 2

      canvasCtx.value.fillRect(x, y, barWidth, barHeight)
    }

    // 绘制进度线
    if (currentTime !== null) {
      const progressX = getXFromTime(currentTime, canvas.value, duration)
      canvasCtx.value.beginPath()
      canvasCtx.value.strokeStyle = COLORS.progress
      canvasCtx.value.lineWidth = 2
      canvasCtx.value.moveTo(progressX, timeAxisHeight)
      canvasCtx.value.lineTo(progressX, timeAxisHeight + waveformHeight)
      canvasCtx.value.stroke()
    }

    // 绘制区域
    drawRegions(regions, hoveredRegion, editingAnnotation, duration, buttonBounds)

    // 绘制选区
    if (selectionRange) {
      drawSelection(selectionRange, duration, buttonBounds)
    }

    // 确保保存最终的按钮边界
    if (buttonBounds.add) {
      buttonBounds.add = { ...buttonBounds.add }
    }
    if (buttonBounds.edit) {
      buttonBounds.edit = { ...buttonBounds.edit }
    }
    if (buttonBounds.delete) {
      buttonBounds.delete = { ...buttonBounds.delete }
    }
  }

  // 绘制时间轴
  const drawTimeAxis = (duration: number, pixelsPerSecond: number) => {
    if (!canvasCtx.value || !canvas.value) return

    const pixelsPerMinute = pixelsPerSecond * 60
    const totalSeconds = Math.ceil(duration)

    // 根据缩放级别选择合适的时间间隔
    let timeInterval = 30
    let minorInterval = 5
    if (pixelsPerSecond >= 30) {
      timeInterval = 1
      minorInterval = 0.2
    } else if (pixelsPerSecond >= 15) {
      timeInterval = 2
      minorInterval = 0.5
    } else if (pixelsPerSecond >= 10) {
      timeInterval = 5
      minorInterval = 1
    } else if (pixelsPerSecond >= 5) {
      timeInterval = 10
      minorInterval = 2
    } else if (pixelsPerSecond >= 2) {
      timeInterval = 15
      minorInterval = 3
    } else if (pixelsPerMinute >= 60) {
      timeInterval = 30
      minorInterval = 5
    } else if (pixelsPerMinute >= 30) {
      timeInterval = 60
      minorInterval = 10
    } else if (pixelsPerMinute >= 15) {
      timeInterval = 300
      minorInterval = 60
    } else if (pixelsPerMinute >= 8) {
      timeInterval = 600
      minorInterval = 120
    } else {
      timeInterval = 1800
      minorInterval = 300
    }

    // 绘制时间轴背景
    canvasCtx.value.fillStyle = COLORS.timeAxis.background
    canvasCtx.value.fillRect(PADDING, 0, canvas.value.width - PADDING * 2, TIME_AXIS_HEIGHT)

    // 绘制次要刻度
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = COLORS.timeAxis.line.secondary
    canvasCtx.value.lineWidth = 1
    for (let second = 0; second <= totalSeconds; second += minorInterval) {
      const x = getXFromTime(second, canvas.value, duration)
      canvasCtx.value.moveTo(x, TIME_AXIS_HEIGHT - 4)
      canvasCtx.value.lineTo(x, TIME_AXIS_HEIGHT)
    }
    canvasCtx.value.stroke()

    // 绘制主要刻度和文本
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = COLORS.timeAxis.line.primary
    canvasCtx.value.lineWidth = 1.5
    canvasCtx.value.fillStyle = COLORS.text.primary
    canvasCtx.value.font = '12px Arial'
    canvasCtx.value.textAlign = 'center'
    canvasCtx.value.textBaseline = 'top'

    for (let second = 0; second <= totalSeconds; second += timeInterval) {
      const x = getXFromTime(second, canvas.value, duration)
      const isMainTick = second % 60 === 0
      const tickLength = isMainTick ? 12 : 8

      canvasCtx.value.moveTo(x, TIME_AXIS_HEIGHT - tickLength)
      canvasCtx.value.lineTo(x, TIME_AXIS_HEIGHT)

      if (isMainTick || timeInterval < 60) {
        const timeText = formatTimeAxis(second)
        canvasCtx.value.fillText(timeText, x, 4)
      }
    }
    canvasCtx.value.stroke()
  }

  // 绘制区域
  const drawRegions = (
    regions: Map<string, Region>,
    hoveredRegion: { id: string } | null,
    editingAnnotation: { id: string } | null,
    duration: number,
    buttonBounds: {
      add: { x: number; y: number; width: number; height: number } | null;
      edit: { x: number; y: number; width: number; height: number } | null;
      delete: { x: number; y: number; width: number; height: number } | null;
    }
  ) => {
    if (!canvasCtx.value || !canvas.value) return

    // 计算各区域高度
    const timeAxisHeight = TIME_AXIS_HEIGHT
    const waveformHeight = WAVEFORM_HEIGHT
    const annotationHeight = canvas.value.height - timeAxisHeight - waveformHeight

    // 重置所有按钮边界
    buttonBounds.edit = null
    buttonBounds.delete = null

    regions.forEach((region, id) => {
      const isHovered = hoveredRegion?.id === id
      const isEditing = editingAnnotation?.id === id

      // 计算区域的位置和尺寸
      const startX = getXFromTime(region.start, canvas.value!, duration)
      const endX = getXFromTime(region.end, canvas.value!, duration)
      const width = endX - startX

      // 绘制波形区域背景
      canvasCtx.value!.fillStyle = isHovered ? COLORS.region.fill.hover : COLORS.region.fill.normal
      canvasCtx.value!.fillRect(
        startX,
        timeAxisHeight,
        width,
        waveformHeight
      )

      // 绘制波形区域边框
      canvasCtx.value!.strokeStyle = isEditing ? COLORS.region.border.editing : COLORS.region.border.normal
      canvasCtx.value!.lineWidth = isEditing ? 2 : 1
      canvasCtx.value!.strokeRect(
        startX,
        timeAxisHeight,
        width,
        waveformHeight
      )

      // 绘制标注区域背景
      canvasCtx.value!.fillStyle = isHovered ? COLORS.region.fill.hover : COLORS.region.fill.normal
      canvasCtx.value!.fillRect(
        startX,
        timeAxisHeight + waveformHeight,
        width,
        annotationHeight
      )

      // 绘制标注区域边框
      canvasCtx.value!.strokeStyle = isEditing ? COLORS.region.border.editing : COLORS.region.border.normal
      canvasCtx.value!.lineWidth = isEditing ? 2 : 1
      canvasCtx.value!.strokeRect(
        startX,
        timeAxisHeight + waveformHeight,
        width,
        annotationHeight
      )

      // 绘制标注文本
      if (region.text) {
        canvasCtx.value!.fillStyle = COLORS.text.primary
        canvasCtx.value!.font = '14px Arial'
        canvasCtx.value!.textBaseline = 'top'
        canvasCtx.value!.textAlign = 'left'
        
        // 计算文本位置和区域
        const textY = timeAxisHeight + waveformHeight + 5
        const textX = startX + 5
        const maxWidth = width - 10 - (isHovered ? BUTTON_SIZE * 2 + BUTTON_GAP + 10 : 0) // 考虑按钮占用的空间
        const lineHeight = 18 // 行高

        // 文本换行处理
        const words = region.text.split('')
        let line = ''
        let lines = []
        
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i]
          const metrics = canvasCtx.value!.measureText(testLine)
          
          if (metrics.width > maxWidth && i > 0) {
            lines.push(line)
            line = words[i]
          } else {
            line = testLine
          }
        }
        lines.push(line)

        // 绘制文本，如果超出区域则裁剪
        canvasCtx.value!.save()
        canvasCtx.value!.beginPath()
        canvasCtx.value!.rect(startX, timeAxisHeight + waveformHeight, width, annotationHeight)
        canvasCtx.value!.clip()

        // 绘制每一行文本，充满整个区域
        lines.forEach((line, index) => {
          // 确保不超出标注区域的高度
          if (textY + (index + 1) * lineHeight <= timeAxisHeight + waveformHeight + annotationHeight - 5) {
            canvasCtx.value!.fillText(line, textX, textY + index * lineHeight)
          }
        })

        canvasCtx.value!.restore()
      }

      // 如果区域被悬停，绘制编辑和删除按钮
      if (isHovered) {
        // 计算按钮的垂直位置，放在标注区域右上角
        const annotationY = timeAxisHeight + waveformHeight
        const buttonY = annotationY + 5 // 顶部边距5px

        // 确保按钮在区域内且不超出画布边界
        const editX = Math.min(startX + width - BUTTON_SIZE * 2 - BUTTON_GAP - 5, canvas.value!.width - PADDING - BUTTON_SIZE * 2 - BUTTON_GAP)
        const deleteX = Math.min(startX + width - BUTTON_SIZE - 5, canvas.value!.width - PADDING - BUTTON_SIZE)

        // 绘制编辑按钮
        drawButton(editX, buttonY, BUTTON_SIZE, COLORS.button.edit)
        drawEditIcon(editX, buttonY, BUTTON_SIZE)

        // 绘制删除按钮
        drawButton(deleteX, buttonY, BUTTON_SIZE, COLORS.button.delete)
        drawDeleteIcon(deleteX, buttonY, BUTTON_SIZE)

        // 设置按钮边界（确保在绘制之后更新）
        buttonBounds.edit = {
          x: editX,
          y: buttonY,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE
        }

        buttonBounds.delete = {
          x: deleteX,
          y: buttonY,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE
        }
      }
    })
  }

  // 绘制选区
  const drawSelection = (
    selectionRange: { start: number; end: number },
    duration: number,
    buttonBounds: {
      add: { x: number; y: number; width: number; height: number } | null;
      edit: { x: number; y: number; width: number; height: number } | null;
      delete: { x: number; y: number; width: number; height: number } | null;
    }
  ) => {
    if (!canvasCtx.value || !canvas.value) return

    const timeAxisHeight = TIME_AXIS_HEIGHT
    const waveformHeight = WAVEFORM_HEIGHT

    // 计算选区的位置和尺寸
    const startX = getXFromTime(selectionRange.start, canvas.value!, duration)
    const endX = getXFromTime(selectionRange.end, canvas.value!, duration)
    const width = endX - startX

    // 绘制选区背景
    canvasCtx.value.fillStyle = COLORS.selection.fill
    canvasCtx.value.fillRect(
      startX,
      timeAxisHeight,
      width,
      waveformHeight
    )

    // 绘制选区边框
    canvasCtx.value.strokeStyle = COLORS.selection.border
    canvasCtx.value.lineWidth = 2
    canvasCtx.value.strokeRect(
      startX,
      timeAxisHeight,
      width,
      waveformHeight
    )

    // 计算按钮位置
    const buttonY = timeAxisHeight + (waveformHeight - BUTTON_SIZE) / 2
    const buttonX = startX + (width - BUTTON_SIZE) / 2

    // 绘制添加按钮
    drawButton(buttonX, buttonY, BUTTON_SIZE, COLORS.button.add)
    drawAddIcon(buttonX, buttonY, BUTTON_SIZE)

    // 更新按钮边界
    buttonBounds.add = {
      x: buttonX,
      y: buttonY,
      width: BUTTON_SIZE,
      height: BUTTON_SIZE
    }
  }

  return {
    canvas,
    canvasCtx,
    channelData,
    container,
    drawWaveform,
    drawRegions,
    drawSelection,
    setChannelData: (data: Float32Array) => {
      channelData.value = data
    },
    initialize: (containerElement: HTMLElement) => {
      container.value = containerElement
      canvas.value = document.createElement('canvas')
      
      // 设置 canvas 的样式尺寸
      canvas.value.style.width = `${containerElement.clientWidth}px`
      canvas.value.style.height = `${containerElement.clientHeight}px`
      
      // 设置 canvas 的实际尺寸
      canvas.value.width = containerElement.clientWidth
      canvas.value.height = containerElement.clientHeight
      
      containerElement.appendChild(canvas.value)
      canvasCtx.value = canvas.value.getContext('2d')
    },
    cleanup: () => {
      if (canvas.value && container.value) {
        container.value.removeChild(canvas.value)
      }
      canvas.value = null
      canvasCtx.value = null
      channelData.value = null
      container.value = null
    }
  }
} 