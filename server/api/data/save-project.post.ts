import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Project } from '~/types/project'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const { project } = await readBody<{ project: Project }>(event)
    if (!project || !project.id) {
      throw createError({
        statusCode: 400,
        message: 'Invalid project data'
      })
    }

    const projectFiles = storage.getProjectFiles(project.id)
    
    // 确保项目目录存在
    await mkdir(resolve(process.cwd(), storage.getProjectPath(project.id)), { recursive: true })
    
    // 确保音频目录存在
    await Promise.all([
      mkdir(resolve(process.cwd(), projectFiles.AUDIO_ORIGINAL), { recursive: true }),
      mkdir(resolve(process.cwd(), projectFiles.AUDIO_CONVERTED), { recursive: true }),
      mkdir(resolve(process.cwd(), projectFiles.EXPORTS), { recursive: true })
    ])

    // 保存项目数据
    await writeFile(
      resolve(process.cwd(), projectFiles.PROJECT),
      JSON.stringify(project, null, 2)
    )

    return { success: true }
  } catch (error) {
    console.error('Failed to save project:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to save project'
    })
  }
}) 