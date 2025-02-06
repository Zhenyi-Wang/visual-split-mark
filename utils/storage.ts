import type { Project, AudioFile, Annotation } from '~/types/project'

const STORAGE_PATH = {
  DATA: 'storage/data',
  PROJECTS: 'storage/data/projects'
}

// 项目文件路径生成函数
function getProjectPath(projectId: string) {
  return `${STORAGE_PATH.PROJECTS}/${projectId}`
}

function getProjectFiles(projectId: string) {
  const basePath = getProjectPath(projectId)
  return {
    PROJECT: `${basePath}/project.json`,
    AUDIO_FILES: `${basePath}/audio_files.json`,
    ANNOTATIONS: `${basePath}/annotations.json`,
    AUDIO_ORIGINAL: `${basePath}/audio/original`,
    AUDIO_CONVERTED: `${basePath}/audio/converted`,
    EXPORTS: `${basePath}/exports`
  }
}

// 音频文件路径生成函数
function getAudioFilePaths(projectId: string, filename: string) {
  const projectFiles = getProjectFiles(projectId)
  return {
    ORIGINAL: `${projectFiles.AUDIO_ORIGINAL}/${filename}`,
    CONVERTED: `${projectFiles.AUDIO_CONVERTED}/${filename}`
  }
}

export const storage = {
  // 项目相关操作
  async saveProject(project: Project) {
    try {
      await $fetch(`/api/data/save-project`, {
        method: 'POST',
        body: { project }
      })
    } catch (error) {
      throw error
    }
  },

  async loadProject(projectId: string) {
    try {
      const response = await $fetch<{
        project: Project
        audioFiles: AudioFile[]
        annotations: Record<string, Annotation[]>
      }>(`/api/data/load-project/${projectId}`)
      return response
    } catch (error) {
      throw error
    }
  },

  async listProjects() {
    try {
      const response = await $fetch<{
        projects: Project[]
      }>('/api/data/list-projects')
      return response.projects
    } catch (error) {
      return []
    }
  },

  async deleteProject(projectId: string) {
    try {
      await $fetch(`/api/data/delete-project/${projectId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      throw error
    }
  },

  // 音频文件相关操作
  async saveAudioFiles(projectId: string, audioFiles: AudioFile[]) {
    try {
      await $fetch(`/api/data/save-audio-files`, {
        method: 'POST',
        body: { projectId, audioFiles }
      })
    } catch (error) {
      throw error
    }
  },

  // 标注相关操作
  async saveAnnotations(projectId: string, audioFileId: string, annotations: Annotation[]) {
    try {
      await $fetch(`/api/data/save-annotations`, {
        method: 'POST',
        body: { projectId, audioFileId, annotations }
      })
    } catch (error) {
      throw error
    }
  },

  // 路径生成
  getProjectPath,
  getProjectFiles,
  getAudioFilePaths,

  // 路径常量
  paths: STORAGE_PATH
} 