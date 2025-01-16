import { readFile } from 'node:fs/promises'
import type { Project, AudioFile, Annotation } from '~/types/project'
import { storage } from '~/utils/storage'

export default defineEventHandler(async () => {
  try {
    // 分别读取不同类型的数据
    const [projects, audioFiles, annotations, settings] = await Promise.all([
      readFile(storage.dataFiles.PROJECTS, 'utf-8')
        .then(data => JSON.parse(data))
        .then(data => Array.isArray(data) ? data : [])
        .catch(() => []),
      readFile(storage.dataFiles.AUDIO_FILES, 'utf-8')
        .then(data => JSON.parse(data))
        .then(data => Array.isArray(data) ? data : [])
        .catch(() => []),
      readFile(storage.dataFiles.ANNOTATIONS, 'utf-8')
        .then(data => JSON.parse(data))
        .then(data => Array.isArray(data) ? data : [])
        .catch(() => []),
      readFile(storage.dataFiles.SETTINGS, 'utf-8')
        .then(JSON.parse)
        .catch(() => ({}))
    ])

    return {
      projects,
      audioFiles,
      annotations,
      settings
    }
  } catch (error) {
    console.error('Failed to load data:', error)
    return {
      projects: [],
      audioFiles: [],
      annotations: [],
      settings: {}
    }
  }
}) 