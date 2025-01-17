import type { Project, AudioFile, Annotation } from '~/types/project'

const STORAGE_PATH = {
  DATA: 'storage/data',
  UPLOADS: 'storage/uploads',
  CONVERTED: 'storage/converted'
}

const DATA_FILES = {
  PROJECTS: `${STORAGE_PATH.DATA}/projects.json`,
  AUDIO_FILES: `${STORAGE_PATH.DATA}/audio_files.json`,
  ANNOTATIONS: `${STORAGE_PATH.DATA}/annotations.json`,
  SETTINGS: `${STORAGE_PATH.DATA}/settings.json`
}

export const storage = {
  async saveData(data: {
    projects?: Project[]
    audioFiles?: AudioFile[]
    annotations?: Annotation[]
    settings?: Record<string, string>
  }) {
    try {
      await $fetch('/api/data/save', {
        method: 'POST',
        body: data
      })
    } catch (error) {
      throw error
    }
  },

  async loadData() {
    try {
      const response = await $fetch<{
        projects: Project[]
        audioFiles: AudioFile[]
        annotations: Annotation[]
        settings: Record<string, string>
      }>('/api/data/load')
      return response
    } catch (error) {
      return {
        projects: [],
        audioFiles: [],
        annotations: [],
        settings: {}
      }
    }
  },

  // 路径常量
  paths: STORAGE_PATH,
  dataFiles: DATA_FILES
} 