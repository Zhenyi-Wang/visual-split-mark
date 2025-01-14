import type { Project, AudioFile, Annotation } from '~/types/project'

interface ProjectData {
  projects: Project[]
  audioFiles: AudioFile[]
  annotations: Annotation[]
  settings: Record<string, string>
  version: string
  lastBackup?: string
}

const STORAGE_PATH = {
  DATA: 'storage/data',
  UPLOADS: 'storage/uploads',
  CONVERTED: 'storage/converted',
  BACKUPS: 'storage/backups'
}

const DATA_FILES = {
  PROJECTS: `${STORAGE_PATH.DATA}/projects.json`,
  SETTINGS: `${STORAGE_PATH.DATA}/settings.json`
}

export const storage = {
  // 项目相关
  async saveProjects(projects: Project[]) {
    const data = await this.loadData()
    data.projects = projects
    await this.saveData(data)
    await this.createBackup(data)
  },

  async loadProjects(): Promise<Project[]> {
    const data = await this.loadData()
    return data.projects.map(p => ({
      ...p,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt)
    }))
  },

  // 音频文件相关
  async saveAudioFiles(files: AudioFile[]) {
    const data = await this.loadData()
    data.audioFiles = files
    await this.saveData(data)
    await this.createBackup(data)
  },

  async loadAudioFiles(): Promise<AudioFile[]> {
    const data = await this.loadData()
    return data.audioFiles.map(f => ({
      ...f,
      createdAt: new Date(f.createdAt),
      updatedAt: new Date(f.updatedAt)
    }))
  },

  // 标注相关
  async saveAnnotations(annotations: Annotation[]) {
    const data = await this.loadData()
    data.annotations = annotations
    await this.saveData(data)
    await this.createBackup(data)
  },

  async loadAnnotations(): Promise<Annotation[]> {
    const data = await this.loadData()
    return data.annotations.map(a => ({
      ...a,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt)
    }))
  },

  // 设置相关
  async saveSettings(settings: Record<string, string>) {
    const data = await this.loadData()
    data.settings = settings
    await this.saveData(data)
  },

  async loadSettings(): Promise<Record<string, string>> {
    const data = await this.loadData()
    return data.settings
  },

  // 数据操作
  async loadData(): Promise<ProjectData> {
    try {
      const response = await $fetch<ProjectData>('/api/data/load')
      return response
    } catch (error) {
      console.error('Failed to load data:', error)
      return {
        projects: [],
        audioFiles: [],
        annotations: [],
        settings: {},
        version: '1.0.0'
      }
    }
  },

  async saveData(data: ProjectData) {
    try {
      await $fetch('/api/data/save', {
        method: 'POST',
        body: data
      })
    } catch (error) {
      console.error('Failed to save data:', error)
      throw error
    }
  },

  // 备份相关
  async createBackup(data: ProjectData): Promise<string> {
    try {
      const response = await $fetch<{ success: boolean; backupPath: string }>('/api/backup/create', {
        method: 'POST',
        body: data
      })
      return response.backupPath
    } catch (error) {
      console.error('Failed to create backup:', error)
      throw error
    }
  },

  async restoreFromBackup(backupPath: string): Promise<ProjectData> {
    try {
      const response = await $fetch<ProjectData>('/api/backup/restore', {
        method: 'POST',
        body: { backupPath }
      })
      return response
    } catch (error) {
      console.error('Failed to restore from backup:', error)
      throw error
    }
  },

  async listBackups(): Promise<string[]> {
    try {
      const response = await $fetch<{ success: boolean; backups: string[] }>('/api/backup/list')
      return response.backups
    } catch (error) {
      console.error('Failed to list backups:', error)
      return []
    }
  },

  // 路径常量
  paths: STORAGE_PATH
} 