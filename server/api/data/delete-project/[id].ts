import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
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

    // 删除项目目录
    const projectPath = resolve(process.cwd(), storage.getProjectPath(projectId))
    await rm(projectPath, { recursive: true, force: true })

    return { success: true }
  } catch (error) {
    console.error('Failed to delete project:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to delete project'
    })
  }
}) 