import type { Region } from '~/types/audio'
import type { Annotation } from '~/types/project'
import type { MergeAnnotationPayload, MergeAnnotationResponse } from '~/types/audio'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { projectId, audioFileId, targetId, sourceId, direction } = body as MergeAnnotationPayload & {
    projectId: string
    audioFileId: string
  }
  
  if (!projectId || !audioFileId) {
    throw createError({
      statusCode: 400,
      message: '缺少项目 ID 或音频文件 ID'
    })
  }
  
  try {
    // 读取项目数据
    const { annotations } = await storage.loadProject(projectId)
    const audioAnnotations = annotations[audioFileId] || []
    
    // 获取两个标注
    const targetAnnotation = audioAnnotations.find(a => a.id === targetId)
    const sourceAnnotation = audioAnnotations.find(a => a.id === sourceId)
    
    if (!targetAnnotation || !sourceAnnotation) {
      throw createError({
        statusCode: 400,
        message: '标注不存在'
      })
    }
    
    // 合并标注
    const mergedAnnotation: Annotation = {
      id: targetId,  // 保留目标标注的 ID
      audioFileId,
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
    const updatedAnnotations = audioAnnotations
      .filter(a => a.id !== sourceId)
      .map(a => a.id === targetId ? mergedAnnotation : a)
    
    // 保存更新后的标注
    await storage.saveAnnotations(projectId, audioFileId, updatedAnnotations)
    
    const response: MergeAnnotationResponse = {
      success: true,
      annotation: mergedAnnotation
    }
    
    return response
  } catch (error) {
    console.error('Failed to merge annotations:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : '合并标注失败'
    })
  }
}) 