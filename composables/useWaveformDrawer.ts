import { ref, readonly } from 'vue'
import type { WaveformDrawer, Region } from '~/types/audio'
import { useViewportStore } from '~/stores/viewport'
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

interface Props {
  // 如果有需要的属性，可以在这里添加
}

export function useWaveformDrawer(props: Props, emit: (event: string, ...args: any[]) => void) {
  // 初始化 canvas 和上下文
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const canvasCtx = ref<CanvasRenderingContext2D | null>(null)
  const channelData = ref<Float32Array | null>(null)
  const container = ref<HTMLElement | null>(null)
  const currentTime = ref(0)

  // 使用 viewport store
  const viewport = useViewportStore()

  // 添加波形数据缓存
  const waveformCache = ref<{
    startTime: number;
    endTime: number;
    pixelsPerSecond: number;
    data: { x: number; y: number; height: number }[];
  } | null>(null)

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
    if (!canvasCtx.value || !canvasRef.value || !channelData.value || !container.value) return

    // 使用 viewport store 的时间范围
    const visibleDuration = viewport.viewDuration
    const totalWidth = visibleDuration * pixelsPerSecond + PADDING * 2
    const actualWidth = Math.max(totalWidth, container.value.clientWidth)
    
    // 设置 Canvas 的尺寸
    canvasRef.value.width = actualWidth
    canvasRef.value.height = container.value.clientHeight
    canvasRef.value.style.width = `${actualWidth}px`
    canvasRef.value.style.height = `${container.value.clientHeight}px`

    // 计算各区域高度
    const timeAxisHeight = TIME_AXIS_HEIGHT
    const waveformHeight = WAVEFORM_HEIGHT
    const annotationHeight = canvasRef.value.height - timeAxisHeight - waveformHeight

    // 清除画布
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)

    // 绘制时间轴
    drawTimeAxis(viewport.startTime, viewport.endTime, pixelsPerSecond)

    // 绘制波形区域背景
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(
      PADDING,
      timeAxisHeight,
      canvasRef.value.width - PADDING * 2,
      waveformHeight
    )

    // 绘制标注区域背景
    canvasCtx.value.fillStyle = '#fff'
    canvasCtx.value.fillRect(
      PADDING,
      timeAxisHeight + waveformHeight,
      canvasRef.value.width - PADDING * 2,
      annotationHeight
    )

    // 绘制分隔线
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = '#ccc'
    canvasCtx.value.lineWidth = 1
    canvasCtx.value.moveTo(PADDING, timeAxisHeight + waveformHeight)
    canvasCtx.value.lineTo(canvasRef.value.width - PADDING, timeAxisHeight + waveformHeight)
    canvasCtx.value.stroke()

    // 绘制波形
    const barWidth = 1
    const barGap = 1
    const viewWidth = canvasRef.value.width - PADDING * 2
    const totalBars = Math.floor(viewWidth / (barWidth + barGap))

    // 检查缓存是否可用
    const shouldUpdateCache = !waveformCache.value ||
      waveformCache.value.startTime !== viewport.startTime ||
      waveformCache.value.endTime !== viewport.endTime ||
      waveformCache.value.pixelsPerSecond !== pixelsPerSecond

    if (shouldUpdateCache) {
      // 计算可见范围内的采样点
      const sampleRate = 48000 // 使用标准采样率
      const startSample = Math.floor(viewport.startTime * sampleRate)
      const endSample = Math.floor(viewport.endTime * sampleRate)
      const visibleSamples = endSample - startSample
      const samplesPerBar = Math.floor(visibleSamples / totalBars)

      // 计算波形数据
      const waveformData = []
      for (let i = 0; i < totalBars; i++) {
        const sampleOffset = startSample + i * samplesPerBar
        const endSampleOffset = sampleOffset + samplesPerBar
        let max = 0

        // 使用 subarray 优化内存访问
        const barSamples = channelData.value.subarray(
          Math.max(0, sampleOffset),
          Math.min(channelData.value.length, endSampleOffset)
        )

        // 计算这个区间的最大振幅
        for (let j = 0; j < barSamples.length; j++) {
          const amplitude = Math.abs(barSamples[j])
          if (amplitude > max) {
            max = amplitude
          }
        }

        const barHeight = max * waveformHeight * 0.8
        const x = i * (barWidth + barGap) + PADDING
        const y = timeAxisHeight + (waveformHeight - barHeight) / 2

        waveformData.push({ x, y, height: barHeight })
      }

      // 更新缓存
      waveformCache.value = {
        startTime: viewport.startTime,
        endTime: viewport.endTime,
        pixelsPerSecond,
        data: waveformData
      }
    }

    // 绘制波形
    canvasCtx.value.fillStyle = COLORS.waveform
    if (waveformCache.value) {
      waveformCache.value.data.forEach(({ x, y, height }) => {
        canvasCtx.value!.fillRect(x, y, barWidth, height)
      })
    }

    // 绘制进度线
    if (currentTime !== null && currentTime >= viewport.startTime && currentTime <= viewport.endTime) {
      const progressX = PADDING + (currentTime - viewport.startTime) * pixelsPerSecond
      canvasCtx.value.beginPath()
      canvasCtx.value.strokeStyle = COLORS.progress
      canvasCtx.value.lineWidth = 2
      canvasCtx.value.moveTo(progressX, timeAxisHeight)
      canvasCtx.value.lineTo(progressX, timeAxisHeight + waveformHeight)
      canvasCtx.value.stroke()
    }

    // 绘制区域
    drawRegions(regions, hoveredRegion, editingAnnotation, duration, pixelsPerSecond, buttonBounds)

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
  const drawTimeAxis = (startTime: number, endTime: number, pixelsPerSecond: number) => {
    if (!canvasCtx.value || !canvasRef.value) return

    const pixelsPerMinute = pixelsPerSecond * 60
    const duration = endTime - startTime

    // 根据缩放级别和可视区域宽度选择合适的时间间隔
    const viewWidth = canvasRef.value.width - PADDING * 2
    const minPixelsBetweenTicks = 50 // 刻度之间的最小像素距离
    
    // 计算合适的时间间隔
    let timeInterval = 1 // 从1秒开始
    while ((timeInterval * pixelsPerSecond) < minPixelsBetweenTicks) {
      if (timeInterval < 60) { // 小于1分钟时，按5秒递增
        timeInterval = Math.ceil(timeInterval / 5) * 5
      } else { // 大于1分钟时，按30秒递增
        timeInterval = Math.ceil(timeInterval / 30) * 30
      }
    }

    // 绘制时间轴背景
    canvasCtx.value.fillStyle = COLORS.timeAxis.background
    canvasCtx.value.fillRect(PADDING, 0, viewWidth, TIME_AXIS_HEIGHT)

    // 计算起始和结束的整数时间点
    const firstTick = Math.ceil(startTime)
    const lastTick = Math.floor(endTime)

    // 绘制次要刻度（每秒一个）
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = COLORS.timeAxis.line.secondary
    canvasCtx.value.lineWidth = 1
    
    // 只在缩放级别较高时显示次要刻度
    if (pixelsPerSecond >= 5) {
      for (let time = firstTick; time <= lastTick; time++) {
        const x = PADDING + (time - startTime) * pixelsPerSecond
        // 只绘制在可视区域内的刻度
        if (x >= PADDING && x <= PADDING + viewWidth) {
          canvasCtx.value.moveTo(x, TIME_AXIS_HEIGHT - 4)
          canvasCtx.value.lineTo(x, TIME_AXIS_HEIGHT)
        }
      }
      canvasCtx.value.stroke()
    }

    // 绘制主要刻度和文本
    canvasCtx.value.beginPath()
    canvasCtx.value.strokeStyle = COLORS.timeAxis.line.primary
    canvasCtx.value.lineWidth = 1.5
    canvasCtx.value.fillStyle = COLORS.text.primary
    canvasCtx.value.font = '12px Arial'
    canvasCtx.value.textAlign = 'center'
    canvasCtx.value.textBaseline = 'top'

    // 从第一个整数时间点开始，按照 timeInterval 的间隔绘制主刻度
    const firstMainTick = Math.ceil(startTime / timeInterval) * timeInterval
    for (let time = firstMainTick; time <= lastTick; time += timeInterval) {
      const x = PADDING + (time - startTime) * pixelsPerSecond
      // 只绘制在可视区域内的刻度和文本
      if (x >= PADDING && x <= PADDING + viewWidth) {
        const isMinuteMark = time % 60 === 0
        const tickLength = isMinuteMark ? 12 : 8

        canvasCtx.value.moveTo(x, TIME_AXIS_HEIGHT - tickLength)
        canvasCtx.value.lineTo(x, TIME_AXIS_HEIGHT)

        // 显示时间文本
        const timeText = formatTimeAxis(time)
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
    pixelsPerSecond: number,
    buttonBounds: {
      add: { x: number; y: number; width: number; height: number } | null;
      edit: { x: number; y: number; width: number; height: number } | null;
      delete: { x: number; y: number; width: number; height: number } | null;
    }
  ) => {
    if (!canvasCtx.value || !canvasRef.value) return

    const ctx = canvasCtx.value // 创建引用以避免重复的空值检查

    // 计算各区域高度
    const timeAxisHeight = TIME_AXIS_HEIGHT
    const waveformHeight = WAVEFORM_HEIGHT
    const annotationHeight = canvasRef.value.height - timeAxisHeight - waveformHeight
    const viewWidth = canvasRef.value.width - PADDING * 2

    // 重置所有按钮边界
    buttonBounds.edit = null
    buttonBounds.delete = null

    // 遍历所有区域，但只绘制可见的部分
    regions.forEach((region, id) => {
      // 检查区域是否在可视范围内
      if (region.end < viewport.startTime || region.start > viewport.endTime) {
        return // 跳过不在可视范围内的区域
      }

      const isHovered = hoveredRegion?.id === id
      const isEditing = editingAnnotation?.id === id

      // 计算区域在视口中的位置
      const startX = PADDING + Math.max(0, region.start - viewport.startTime) * pixelsPerSecond
      const endX = PADDING + Math.min(viewport.endTime - viewport.startTime, region.end - viewport.startTime) * pixelsPerSecond
      const width = endX - startX

      // 绘制波形区域背景
      ctx.fillStyle = isHovered ? COLORS.region.fill.hover : COLORS.region.fill.normal
      ctx.fillRect(
        startX,
        timeAxisHeight,
        width,
        waveformHeight
      )

      // 绘制波形区域边框
      ctx.strokeStyle = isEditing ? COLORS.region.border.editing : COLORS.region.border.normal
      ctx.lineWidth = isEditing ? 2 : 1
      ctx.strokeRect(
        startX,
        timeAxisHeight,
        width,
        waveformHeight
      )

      // 绘制标注区域背景
      ctx.fillStyle = isHovered ? COLORS.region.fill.hover : COLORS.region.fill.normal
      ctx.fillRect(
        startX,
        timeAxisHeight + waveformHeight,
        width,
        annotationHeight
      )

      // 绘制标注区域边框
      ctx.strokeStyle = isEditing ? COLORS.region.border.editing : COLORS.region.border.normal
      ctx.lineWidth = isEditing ? 2 : 1
      ctx.strokeRect(
        startX,
        timeAxisHeight + waveformHeight,
        width,
        annotationHeight
      )

      // 绘制标注文本
      if (region.text) {
        ctx.fillStyle = COLORS.text.primary
        ctx.font = '14px Arial'
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        
        // 计算文本位置和区域
        const textY = timeAxisHeight + waveformHeight + 5
        const textX = startX + 5
        const maxWidth = width - 10 - (isHovered ? BUTTON_SIZE * 2 + BUTTON_GAP + 10 : 0)
        const lineHeight = 18

        // 文本换行处理
        const words = region.text.split('')
        let line = ''
        let lines = []
        
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i]
          const metrics = ctx.measureText(testLine)
          
          if (metrics.width > maxWidth && i > 0) {
            lines.push(line)
            line = words[i]
          } else {
            line = testLine
          }
        }
        lines.push(line)

        // 绘制文本，如果超出区域则裁剪
        ctx.save()
        ctx.beginPath()
        ctx.rect(startX, timeAxisHeight + waveformHeight, width, annotationHeight)
        ctx.clip()

        // 绘制每一行文本
        lines.forEach((line, index) => {
          if (textY + (index + 1) * lineHeight <= timeAxisHeight + waveformHeight + annotationHeight - 5) {
            ctx.fillText(line, textX, textY + index * lineHeight)
          }
        })

        ctx.restore()
      }

      // 如果区域被悬停，绘制编辑和删除按钮
      if (isHovered) {
        const annotationY = timeAxisHeight + waveformHeight
        const buttonY = annotationY + 5

        // 确保按钮在可视区域内
        const editX = Math.min(startX + width - BUTTON_SIZE * 2 - BUTTON_GAP - 5, PADDING + viewWidth - BUTTON_SIZE * 2 - BUTTON_GAP)
        const deleteX = Math.min(startX + width - BUTTON_SIZE - 5, PADDING + viewWidth - BUTTON_SIZE)

        // 只有当按钮完全在可视区域内时才绘制
        if (editX >= PADDING && editX + BUTTON_SIZE * 2 + BUTTON_GAP <= PADDING + viewWidth) {
          // 绘制编辑按钮
          drawButton(editX, buttonY, BUTTON_SIZE, COLORS.button.edit)
          drawEditIcon(editX, buttonY, BUTTON_SIZE)

          // 绘制删除按钮
          drawButton(deleteX, buttonY, BUTTON_SIZE, COLORS.button.delete)
          drawDeleteIcon(deleteX, buttonY, BUTTON_SIZE)

          // 更新按钮边界
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
    if (!canvasCtx.value || !canvasRef.value) return

    const timeAxisHeight = TIME_AXIS_HEIGHT
    const waveformHeight = WAVEFORM_HEIGHT

    // 计算选区的位置和尺寸
    const startX = getXFromTime(selectionRange.start, canvasRef.value!, duration)
    const endX = getXFromTime(selectionRange.end, canvasRef.value!, duration)
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

  function handleMouseMove(e: MouseEvent) {
    if (!canvasRef.value) return

    const rect = canvasRef.value.getBoundingClientRect()
    const x = e.clientX - rect.left

    // 使用 viewport 的坐标转换方法
    const time = viewport.getTimeFromX(x, canvasRef.value.width)
    
    // 更新当前时间
    currentTime.value = time
  }

  function handleClick(e: MouseEvent) {
    if (!canvasRef.value) return

    const rect = canvasRef.value.getBoundingClientRect()
    const x = e.clientX - rect.left

    // 使用 viewport 的坐标转换方法
    const time = viewport.getTimeFromX(x, canvasRef.value.width)
    
    // 触发点击事件
    emit('click', time)
  }

  return {
    canvasRef,
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
      canvasRef.value = document.createElement('canvas')
      canvasRef.value.style.width = `${containerElement.clientWidth}px`
      canvasRef.value.style.height = `${containerElement.clientHeight}px`
      canvasRef.value.width = containerElement.clientWidth
      canvasRef.value.height = containerElement.clientHeight
      containerElement.appendChild(canvasRef.value)
      canvasCtx.value = canvasRef.value.getContext('2d')
    },
    cleanup: () => {
      if (canvasRef.value && container.value) {
        container.value.removeChild(canvasRef.value)
      }
      canvasRef.value = null
      canvasCtx.value = null
      channelData.value = null
      container.value = null
    },
    currentTime,
    handleMouseMove,
    handleClick,
  }
} 