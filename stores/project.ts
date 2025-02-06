import { defineStore } from 'pinia'
import type { Project, AudioFile, Annotation } from '~/types/project'
import { storage } from '~/utils/storage'

interface ProjectState {
  projects: Project[]
  audioFiles: AudioFile[]
  annotations: Record<string, Annotation[]>
  currentProject: Project | null
  currentAudioFile: AudioFile | null
  loading: boolean
  error: string | null
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    projects: [],
    audioFiles: [],
    annotations: {},
    currentProject: null,
    currentAudioFile: null,
    loading: false,
    error: null
  }),

  getters: {
    projectAudioFiles: (state): AudioFile[] => {
      return state.audioFiles
    },

    audioFileAnnotations: (state): Annotation[] => {
      const currentAudioFile = state.currentAudioFile
      if (!currentAudioFile) return []
      return state.annotations[currentAudioFile.id] || []
    }
  },

  actions: {
    async initialize() {
      this.loading = true
      this.error = null
      try {
        // 只加载项目列表
        const projects = await storage.listProjects()
        this.projects = projects.map(project => ({
          ...project,
          createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
          updatedAt: project.updatedAt ? new Date(project.updatedAt) : new Date()
        }))
        
        // 清空其他数据
        this.audioFiles = []
        this.annotations = {}
        this.currentProject = null
        this.currentAudioFile = null
      } catch (error) {
        console.error('Failed to load projects:', error)
        this.error = error instanceof Error ? error.message : String(error)
        this.projects = []
        throw error
      } finally {
        this.loading = false
      }
    },

    async loadProject(projectId: string) {
      this.loading = true
      this.error = null
      try {
        const data = await storage.loadProject(projectId)
        
        // 更新当前项目
        const project = {
          ...data.project,
          createdAt: data.project.createdAt ? new Date(data.project.createdAt) : new Date(),
          updatedAt: data.project.updatedAt ? new Date(data.project.updatedAt) : new Date()
        }
        this.currentProject = project
        
        // 更新项目列表中的项目数据
        const index = this.projects.findIndex(p => p.id === projectId)
        if (index > -1) {
          this.projects[index] = project
        }
        
        // 更新音频文件
        this.audioFiles = data.audioFiles.map(file => ({
          ...file,
          createdAt: file.createdAt ? new Date(file.createdAt) : new Date(),
          updatedAt: file.updatedAt ? new Date(file.updatedAt) : new Date()
        }))
        
        // 更新标注
        this.annotations = data.annotations
      } catch (error) {
        console.error('Failed to load project:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    setCurrentProject(project: Project | null) {
      this.currentProject = project
      if (project) {
        this.loadProject(project.id)
      } else {
        this.audioFiles = []
        this.annotations = {}
        this.currentAudioFile = null
      }
    },

    setCurrentAudioFile(audioFile: AudioFile | null) {
      this.currentAudioFile = audioFile
    },

    async createProject(name: string, description?: string, whisperApiUrl?: string) {
      this.loading = true
      this.error = null
      try {
        const project: Project = {
          id: crypto.randomUUID(),
          name,
          description,
          whisperApiUrl,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        
        // 保存项目
        await storage.saveProject(project)
        
        // 更新状态
        this.projects.push(project)
        return project
      } catch (error) {
        console.error('Failed to create project:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateProject(project: Project) {
      this.loading = true
      this.error = null
      try {
        // 更新项目
        await storage.saveProject(project)
        
        // 更新状态
        const index = this.projects.findIndex(p => p.id === project.id)
        if (index > -1) {
          this.projects[index] = project
        }
        if (this.currentProject?.id === project.id) {
          this.currentProject = project
        }
      } catch (error) {
        console.error('Failed to update project:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteProject(id: string) {
      this.loading = true
      this.error = null
      try {
        // 删除项目
        await storage.deleteProject(id)
        
        // 更新状态
        const index = this.projects.findIndex(p => p.id === id)
        if (index > -1) {
          this.projects.splice(index, 1)
        }
        if (this.currentProject?.id === id) {
          this.currentProject = null
          this.audioFiles = []
          this.annotations = {}
          this.currentAudioFile = null
        }
      } catch (error) {
        console.error('Failed to delete project:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async addAudioFile(audioFile: AudioFile) {
      if (!this.currentProject) throw new Error('No project selected')
      
      this.loading = true
      this.error = null
      try {
        // 添加到列表
        this.audioFiles.push(audioFile)
        
        // 保存音频文件列表
        await storage.saveAudioFiles(this.currentProject.id, this.audioFiles)
        
        return audioFile
      } catch (error) {
        console.error('Failed to add audio file:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateAudioFile(audioFile: AudioFile) {
      if (!this.currentProject) throw new Error('No project selected')
      
      this.loading = true
      this.error = null
      try {
        // 更新列表
        const index = this.audioFiles.findIndex(f => f.id === audioFile.id)
        if (index > -1) {
          this.audioFiles[index] = audioFile
          
          // 保存音频文件列表
          await storage.saveAudioFiles(this.currentProject.id, this.audioFiles)
          
          if (this.currentAudioFile?.id === audioFile.id) {
            this.currentAudioFile = audioFile
          }
        }
      } catch (error) {
        console.error('Failed to update audio file:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteAudioFile(id: string) {
      if (!this.currentProject) throw new Error('No project selected')
      
      this.loading = true
      this.error = null
      try {
        // 更新列表
        const index = this.audioFiles.findIndex(f => f.id === id)
        if (index > -1) {
          this.audioFiles.splice(index, 1)
          
          // 删除标注
          delete this.annotations[id]
          
          // 保存更改
          await Promise.all([
            storage.saveAudioFiles(this.currentProject.id, this.audioFiles),
            storage.saveAnnotations(this.currentProject.id, id, [])
          ])
          
          if (this.currentAudioFile?.id === id) {
            this.currentAudioFile = null
          }
        }
      } catch (error) {
        console.error('Failed to delete audio file:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateAnnotation(annotation: Annotation) {
      if (!this.currentProject || !this.currentAudioFile) {
        throw new Error('No project or audio file selected')
      }
      
      this.loading = true
      this.error = null
      try {
        // 确保数组存在
        if (!this.annotations[this.currentAudioFile.id]) {
          this.annotations[this.currentAudioFile.id] = []
        }
        
        // 更新或添加标注
        const annotations = this.annotations[this.currentAudioFile.id]
        const index = annotations.findIndex((a: Annotation) => a.id === annotation.id)
        if (index > -1) {
          annotations[index] = annotation
        } else {
          annotations.push({
            ...annotation,
            id: crypto.randomUUID()
          })
        }
        
        // 保存标注
        await storage.saveAnnotations(
          this.currentProject.id,
          this.currentAudioFile.id,
          annotations
        )
      } catch (error) {
        console.error('Failed to update annotation:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteAnnotation(id: string) {
      if (!this.currentProject || !this.currentAudioFile) {
        throw new Error('No project or audio file selected')
      }
      
      this.loading = true
      this.error = null
      try {
        // 更新标注列表
        const annotations = this.annotations[this.currentAudioFile.id] || []
        const index = annotations.findIndex((a: Annotation) => a.id === id)
        if (index > -1) {
          annotations.splice(index, 1)
          
          // 保存更改
          await storage.saveAnnotations(
            this.currentProject.id,
            this.currentAudioFile.id,
            annotations
          )
        }
      } catch (error) {
        console.error('Failed to delete annotation:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateAnnotations(annotations: Annotation[]) {
      if (!this.currentProject || !this.currentAudioFile) {
        throw new Error('No project or audio file selected')
      }
      
      this.loading = true
      this.error = null
      try {
        // 更新标注
        this.annotations[this.currentAudioFile.id] = annotations
        
        // 保存更改
        await storage.saveAnnotations(
          this.currentProject.id,
          this.currentAudioFile.id,
          annotations
        )
      } catch (error) {
        console.error('Failed to update annotations:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    }
  }
}) 