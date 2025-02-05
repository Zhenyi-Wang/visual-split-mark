import type { Region } from '~/types/audio'
import type { Annotation } from '~/types/project'
import type { MergeAnnotationPayload, MergeAnnotationResponse } from '~/types/audio'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { targetId, sourceId, direction } = body as MergeAnnotationPayload
  
  // 读取当前数据
  const data = await storage.loadData()
  
  // 获取两个标注
  const targetAnnotation = data.annotations.find(a => a.id === targetId)
  const sourceAnnotation = data.annotations.find(a => a.id === sourceId)
  
  if (!targetAnnotation || !sourceAnnotation) {
    throw createError({
      statusCode: 400,
      message: '标注不存在'
    })
  }
  
  // 合并标注
  const mergedAnnotation: Annotation = {
    id: targetId,  // 保留目标标注（相邻标注）的 ID
    audioFileId: targetAnnotation.audioFileId,
    // 如果向左合并，使用目标（左侧）标注的开始时间和源标注的结束时间
    // 如果向右合并，使用源标注的开始时间和目标（右侧）标注的结束时间
    start: direction === 'left' ? targetAnnotation.start : sourceAnnotation.start,
    end: direction === 'right' ? targetAnnotation.end : sourceAnnotation.end,
    // 直接拼接文本，不加空格
    text: direction === 'left' 
      ? `${targetAnnotation.text}${sourceAnnotation.text}`
      : `${sourceAnnotation.text}${targetAnnotation.text}`,
    // 同样合并 whisperText
    whisperText: direction === 'left'
      ? `${targetAnnotation.whisperText || ''}${sourceAnnotation.whisperText || ''}`
      : `${sourceAnnotation.whisperText || ''}${targetAnnotation.whisperText || ''}`,
    createdAt: targetAnnotation.createdAt,
    updatedAt: new Date()
  }
  
  // 更新数据：先删除源标注，再更新目标标注
  data.annotations = data.annotations.filter(a => a.id !== sourceId)
  const targetIndex = data.annotations.findIndex(a => a.id === targetId)
  if (targetIndex !== -1) {
    data.annotations[targetIndex] = mergedAnnotation
  } else {
    data.annotations.push(mergedAnnotation)
  }
  
  // 保存数据
  await storage.saveData({
    annotations: data.annotations
  })
  
  const response: MergeAnnotationResponse = {
    success: true,
    annotation: mergedAnnotation
  }
  
  return response
}) 