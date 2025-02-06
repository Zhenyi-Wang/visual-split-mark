import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Project, AudioFile, Annotation } from '~/types/project'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const projectId = getRouterParam(event, 'id')
    if (!projectId) {
      throw createError({
        statusCode: 400,
        message: 'Project ID is required'
      })
    }

    const projectFiles = storage.getProjectFiles(projectId)

    // 读取项目数据
    const [projectData, audioFilesData, annotationsData] = await Promise.all([
      readFile(resolve(process.cwd(), projectFiles.PROJECT), 'utf-8')
        .then(data => JSON.parse(data) as Project)
        .catch(() => {
          throw createError({
            statusCode: 404,
            message: 'Project not found'
          })
        }),
      readFile(resolve(process.cwd(), projectFiles.AUDIO_FILES), 'utf-8')
        .then(data => JSON.parse(data) as AudioFile[])
        .catch(() => [] as AudioFile[]),
      readFile(resolve(process.cwd(), projectFiles.ANNOTATIONS), 'utf-8')
        .then(data => JSON.parse(data) as Record<string, Annotation[]>)
        .catch(() => ({} as Record<string, Annotation[]>))
    ])

    return {
      project: projectData,
      audioFiles: audioFilesData,
      annotations: annotationsData
    }
  } catch (error) {
    console.error('Failed to load project:', error)
    throw error instanceof Error && 'statusCode' in error
      ? error
      : createError({
          statusCode: 500,
          message: error instanceof Error ? error.message : 'Failed to load project'
        })
  }
}) 