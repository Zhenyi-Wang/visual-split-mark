import { writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Annotation } from '~/types/project'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const { projectId, audioFileId, annotations } = await readBody<{
      projectId: string
      audioFileId: string
      annotations: Annotation[]
    }>(event)

    if (!projectId || !audioFileId || !Array.isArray(annotations)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid request data'
      })
    }

    const projectFiles = storage.getProjectFiles(projectId)

    // 读取现有标注数据
    let annotationsData: Record<string, Annotation[]> = {}
    try {
      const data = await readFile(resolve(process.cwd(), projectFiles.ANNOTATIONS), 'utf-8')
      annotationsData = JSON.parse(data)
    } catch (error) {
      // 如果文件不存在或解析失败，使用空对象
      console.log('No existing annotations found or failed to parse')
    }

    // 更新指定音频文件的标注
    annotationsData[audioFileId] = annotations

    // 保存标注数据
    await writeFile(
      resolve(process.cwd(), projectFiles.ANNOTATIONS),
      JSON.stringify(annotationsData, null, 2)
    )

    return { success: true }
  } catch (error) {
    console.error('Failed to save annotations:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to save annotations'
    })
  }
}) 