import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Project, AudioFile, Annotation } from '~/types/project'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    projects?: Project[]
    audioFiles?: AudioFile[]
    annotations?: Annotation[]
    settings?: Record<string, string>
  }>(event)

  try {
    // 确保目录存在
    await mkdir(storage.paths.DATA, { recursive: true })

    // 分别保存不同类型的数据
    if (body.projects) {
      await writeFile(storage.dataFiles.PROJECTS, JSON.stringify(body.projects, null, 2))
    }
    if (body.audioFiles) {
      await writeFile(storage.dataFiles.AUDIO_FILES, JSON.stringify(body.audioFiles, null, 2))
    }
    if (body.annotations) {
      await writeFile(storage.dataFiles.ANNOTATIONS, JSON.stringify(body.annotations, null, 2))
    }
    if (body.settings) {
      await writeFile(storage.dataFiles.SETTINGS, JSON.stringify(body.settings, null, 2))
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to save data:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to save data'
    })
  }
}) 