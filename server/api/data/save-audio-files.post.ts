import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AudioFile } from '~/types/project'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const { projectId, audioFiles } = await readBody<{
      projectId: string
      audioFiles: AudioFile[]
    }>(event)

    if (!projectId || !Array.isArray(audioFiles)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid request data'
      })
    }

    const projectFiles = storage.getProjectFiles(projectId)

    // 保存音频文件列表
    await writeFile(
      resolve(process.cwd(), projectFiles.AUDIO_FILES),
      JSON.stringify(audioFiles, null, 2)
    )

    return { success: true }
  } catch (error) {
    console.error('Failed to save audio files:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to save audio files'
    })
  }
}) 