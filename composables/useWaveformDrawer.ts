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
  COLORS
} from '~/constants/visualizer'
import { formatTimeAxis, getYFromTime } from '~/utils/timeFormat'

export function useWaveformDrawer() {
  const canvas = ref<HTMLCanvasElement | null>(null)
  const canvasCtx = ref<CanvasRenderingContext2D | null>(null)
  const channelData = ref<Float32Array | null>(null)

  // 绘制圆形按钮的辅助函数
  const drawCircleButton = (x: number, y: number, size: number, color: string, icon: 'add' | 'edit' | 'delete') => {
    if (!canvasCtx.value) return

    // 绘制按钮背景
    const centerX = x + size/2
    const centerY = y + size/2
    canvasCtx.value.fillStyle = color
    canvasCtx.value.beginPath()
    canvasCtx.value.arc(centerX, centerY, size/2, 0, Math.PI * 2)
    canvasCtx.value.fill()

    // 绘制图标
    canvasCtx.value.strokeStyle = '#fff'
    canvasCtx.value.lineWidth = 2
    canvasCtx.value.beginPath()

    const iconSize = size * 0.4 // 图标大小为按钮的 40%

    if (icon === 'add') {
      // 绘制加号
      canvasCtx.value.moveTo(centerX - iconSize/2, centerY)
      canvasCtx.value.lineTo(centerX + iconSize/2, centerY)
      canvasCtx.value.moveTo(centerX, centerY - iconSize/2)
      canvasCtx.value.lineTo(centerX, centerY + iconSize/2)
    } else if (icon === 'edit') {
      // 绘制编辑图标（铅笔）
      canvasCtx.value.moveTo(centerX - iconSize/2, centerY + iconSize/2)
      canvasCtx.value.lineTo(centerX + iconSize/2, centerY - iconSize/2)
      canvasCtx.value.moveTo(centerX - iconSize/2, centerY + iconSize/2)
      canvasCtx.value.lineTo(centerX - iconSize/3, centerY + iconSize/2)
    } else if (icon === 'delete') {
      // 绘制删除图标（X）
      canvasCtx.value.moveTo(centerX - iconSize/2, centerY - iconSize/2)
      canvasCtx.value.lineTo(centerX + iconSize/2, centerY + iconSize/2)
      canvasCtx.value.moveTo(centerX + iconSize/2, centerY - iconSize/2)
      canvasCtx.value.lineTo(centerX - iconSize/2, centerY + iconSize/2)
    }
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
    if (!canvasCtx.value || !canvas.value || !channelData.value) return

    // 根据缩放比例计算总高度
    const totalHeight = duration * pixelsPerSecond + PADDING * 2
    
    // 同时设置 Canvas 的实际像素高度和 CSS 样式高度
    canvas.value.height = totalHeight
    canvas.value.style.height = `${totalHeight}px`

    const annotationWidth = canvas.value.width - TIME_AXIS_WIDTH - WAVEFORM_WIDTH

    // 清除画布
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(0, 0, canvas.value.width, canvas.value.height)

    // 绘制时间轴背景
    canvasCtx.value.fillStyle = COLORS.timeAxis.background
    canvasCtx.value.fillRect(0, 0, TIME_AXIS_WIDTH, canvas.value.height)

    // 绘制波形区域背景
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(TIME_AXIS_WIDTH, 0, WAVEFORM_WIDTH, canvas.value.height)

    // 绘制标注区域背景
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, 0, annotationWidth, canvas.value.height)

    // 绘制分隔线
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = '#ccc'
    canvasCtx.value.lineWidth = 1
    canvasCtx.value.moveTo(TIME_AXIS_WIDTH, 0)
    canvasCtx.value.lineTo(TIME_AXIS_WIDTH, canvas.value.height)
    canvasCtx.value.moveTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, 0)
    canvasCtx.value.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, canvas.value.height)
    canvasCtx.value.stroke()

    // 绘制波形
    const barWidth = 1
    const barGap = 1
    const totalBars = Math.floor((totalHeight - PADDING * 2) / (barWidth + barGap))
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

      const barHeight = max * WAVEFORM_WIDTH * 0.8
      const x = TIME_AXIS_WIDTH + (WAVEFORM_WIDTH - barHeight) / 2
      const y = i * (barWidth + barGap) + PADDING

      canvasCtx.value.fillRect(x, y, barHeight, barWidth)
    }

    // 绘制时间轴
    drawTimeAxis(duration, pixelsPerSecond)

    // 绘制进度线
    if (currentTime !== null) {
      const progressY = getYFromTime(currentTime, canvas.value, duration)
      canvasCtx.value.beginPath()
      canvasCtx.value.strokeStyle = COLORS.progress
      canvasCtx.value.lineWidth = 2
      canvasCtx.value.moveTo(TIME_AXIS_WIDTH, progressY)
      canvasCtx.value.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, progressY)
      canvasCtx.value.stroke()
    }

    // 绘制区域
    drawRegions(regions, hoveredRegion, editingAnnotation, duration, buttonBounds)

    // 绘制选区
    if (selectionRange) {
      drawSelection(selectionRange, duration, buttonBounds.add)
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

    // 绘制次要刻度
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = COLORS.timeAxis.line.secondary
    canvasCtx.value.lineWidth = 1
    for (let second = 0; second <= totalSeconds; second += minorInterval) {
      const y = getYFromTime(second, canvas.value, duration)
      canvasCtx.value.moveTo(TIME_AXIS_WIDTH - 4, y)
      canvasCtx.value.lineTo(TIME_AXIS_WIDTH, y)
    }
    canvasCtx.value.stroke()

    // 绘制主要刻度和文本
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = COLORS.timeAxis.line.primary
    canvasCtx.value.lineWidth = 1.5
    canvasCtx.value.fillStyle = COLORS.text.primary
    canvasCtx.value.font = '12px Arial'
    canvasCtx.value.textAlign = 'right'
    canvasCtx.value.textBaseline = 'middle'

    for (let second = 0; second <= totalSeconds; second += timeInterval) {
      const y = getYFromTime(second, canvas.value, duration)
      const isMainTick = second % 60 === 0
      const tickLength = isMainTick ? 12 : 8

      canvasCtx.value.moveTo(TIME_AXIS_WIDTH - tickLength, y)
      canvasCtx.value.lineTo(TIME_AXIS_WIDTH, y)

      if (isMainTick || timeInterval < 60) {
        const timeText = formatTimeAxis(second)
        canvasCtx.value.fillText(timeText, TIME_AXIS_WIDTH - (tickLength + 8), y)
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
      edit: { x: number; y: number; width: number; height: number } | null;
      delete: { x: number; y: number; width: number; height: number } | null;
    }
  ) => {
    if (!canvasCtx.value || !canvas.value) return

    regions.forEach((region, id) => {
      const startY = getYFromTime(region.start, canvas.value!, duration)
      const endY = getYFromTime(region.end, canvas.value!, duration)
      const isHovered = hoveredRegion?.id === id
      const isEditing = editingAnnotation?.id === id

      // 绘制背景
      canvasCtx.value!.fillStyle = isEditing 
        ? COLORS.region.fill.editing 
        : (isHovered ? COLORS.region.fill.hover : COLORS.region.fill.normal)
      canvasCtx.value!.fillRect(
        TIME_AXIS_WIDTH,
        Math.min(startY, endY),
        WAVEFORM_WIDTH,
        Math.abs(endY - startY)
      )

      // 绘制边框
      canvasCtx.value!.beginPath()
      canvasCtx.value!.strokeStyle = isEditing
        ? COLORS.region.border.editing
        : (isHovered ? COLORS.region.border.hover : COLORS.region.border.normal)
      canvasCtx.value!.lineWidth = isEditing || isHovered ? 2 : 1
      canvasCtx.value!.moveTo(TIME_AXIS_WIDTH, startY)
      canvasCtx.value!.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, startY)
      canvasCtx.value!.moveTo(TIME_AXIS_WIDTH, endY)
      canvasCtx.value!.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, endY)
      canvasCtx.value!.stroke()

      // 绘制手柄
      if (isEditing || isHovered) {
        canvasCtx.value!.fillStyle = COLORS.region.border.editing
        canvasCtx.value!.beginPath()
        canvasCtx.value!.arc(
          TIME_AXIS_WIDTH + WAVEFORM_WIDTH / 2,
          startY,
          HANDLE_VISUAL_SIZE,
          0,
          Math.PI * 2
        )
        canvasCtx.value!.fill()
        canvasCtx.value!.beginPath()
        canvasCtx.value!.arc(
          TIME_AXIS_WIDTH + WAVEFORM_WIDTH / 2,
          endY,
          HANDLE_VISUAL_SIZE,
          0,
          Math.PI * 2
        )
        canvasCtx.value!.fill()
      }

      // 绘制按钮
      if (isHovered) {
        const buttonY = Math.min(startY, endY) + BUTTON_PADDING

        if (buttonBounds.delete) {
          drawCircleButton(
            buttonBounds.delete.x,
            buttonY,
            BUTTON_SIZE,
            COLORS.button.delete,
            'delete'
          )
        }

        if (buttonBounds.edit) {
          drawCircleButton(
            buttonBounds.edit.x,
            buttonY,
            BUTTON_SIZE,
            COLORS.button.edit,
            'edit'
          )
        }
      }

      // 绘制文本
      drawRegionText(region.text || '', startY, endY)
    })
  }

  // 绘制区域文本
  const drawRegionText = (text: string, startY: number, endY: number) => {
    if (!canvasCtx.value || !canvas.value) return

    const textY = Math.min(startY, endY)
    const textX = TIME_AXIS_WIDTH + WAVEFORM_WIDTH + 16
    const annotationWidth = canvas.value.width - TIME_AXIS_WIDTH - WAVEFORM_WIDTH

    canvasCtx.value.font = '14px Arial'
    canvasCtx.value.textBaseline = 'top'
    canvasCtx.value.fillStyle = COLORS.text.primary
    canvasCtx.value.textAlign = 'left'

    const maxWidth = annotationWidth - 32
    const words = text.split('')
    let line = ''
    const lines: string[] = []

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n]
      const metrics = canvasCtx.value.measureText(testLine)
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line)
        line = words[n]
      } else {
        line = testLine
      }
    }
    lines.push(line)

    const lineHeight = 20
    const startTextY = textY + 8

    lines.forEach((line, index) => {
      canvasCtx.value!.fillText(line, textX, startTextY + index * lineHeight)
    })
  }

  // 绘制选区
  const drawSelection = (
    selection: { start: number; end: number },
    duration: number,
    addButtonBounds: { x: number; y: number; width: number; height: number } | null
  ) => {
    if (!canvasCtx.value || !canvas.value) return

    const startY = getYFromTime(selection.start, canvas.value, duration)
    const endY = getYFromTime(selection.end, canvas.value, duration)

    // 绘制背景
    canvasCtx.value.fillStyle = COLORS.selection.fill
    canvasCtx.value.fillRect(
      TIME_AXIS_WIDTH,
      Math.min(startY, endY),
      WAVEFORM_WIDTH,
      Math.abs(endY - startY)
    )

    // 绘制边框
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = COLORS.selection.border
    canvasCtx.value.lineWidth = 2
    canvasCtx.value.moveTo(TIME_AXIS_WIDTH, startY)
    canvasCtx.value.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, startY)
    canvasCtx.value.moveTo(TIME_AXIS_WIDTH, endY)
    canvasCtx.value.lineTo(TIME_AXIS_WIDTH + WAVEFORM_WIDTH, endY)
    canvasCtx.value.stroke()

    // 绘制添加按钮
    if (addButtonBounds) {
      drawCircleButton(
        addButtonBounds.x,
        Math.min(startY, endY) + BUTTON_PADDING,
        BUTTON_SIZE,
        COLORS.button.add,
        'add'
      )
    }
  }

  const initialize = (container: HTMLElement) => {
    canvas.value = document.createElement('canvas')
    canvas.value.className = 'vertical-waveform'
    canvas.value.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      background: #fff;
      border-radius: 4px;
    `
    canvas.value.width = container.clientWidth

    container.appendChild(canvas.value)

    canvasCtx.value = canvas.value.getContext('2d')
    if (!canvasCtx.value) {
      throw new Error('Failed to get canvas context')
    }
  }

  const setChannelData = (data: Float32Array) => {
    channelData.value = data
  }

  const destroy = () => {
    if (canvas.value) {
      canvas.value.remove()
      canvas.value = null
    }
    canvasCtx.value = null
    channelData.value = null
  }

  return {
    canvas,
    canvasCtx,
    channelData,
    initialize,
    setChannelData,
    drawWaveform,
    destroy
  }
} 