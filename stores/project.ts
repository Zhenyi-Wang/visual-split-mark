import { defineStore } from 'pinia'
import type { Project, AudioFile, Annotation } from '~/types/project'
import { storage } from '~/utils/storage'

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [] as Project[],
    audioFiles: [] as AudioFile[],
    annotations: [] as Annotation[],
    currentProject: null as Project | null,
    currentAudioFile: null as AudioFile | null,
    loading: false,
    error: null as string | null
  }),

  getters: {
    projectAudioFiles: (state) => {
      const currentProject = state.currentProject
      if (!currentProject) return []
      return state.audioFiles.filter(f => f.projectId === currentProject.id)
    },

    audioFileAnnotations: (state) => {
      const currentAudioFile = state.currentAudioFile
      if (!currentAudioFile) return []
      return state.annotations.filter(a => a.audioFileId === currentAudioFile.id)
    }
  },

  actions: {
    async initialize() {
      this.loading = true
      this.error = null
      try {
        const data = await storage.loadData()
        this.projects = Array.isArray(data.projects) ? data.projects.map(project => ({
          ...project,
          createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
          updatedAt: project.updatedAt ? new Date(project.updatedAt) : new Date()
        })) : []
        this.audioFiles = Array.isArray(data.audioFiles) ? data.audioFiles.map(file => ({
          ...file,
          createdAt: file.createdAt ? new Date(file.createdAt) : new Date(),
          updatedAt: file.updatedAt ? new Date(file.updatedAt) : new Date()
        })) : []
        this.annotations = Array.isArray(data.annotations) ? data.annotations.map(annotation => ({
          ...annotation,
          createdAt: annotation.createdAt ? new Date(annotation.createdAt) : new Date(),
          updatedAt: annotation.updatedAt ? new Date(annotation.updatedAt) : new Date()
        })) : []
      } catch (error) {
        console.error('Failed to load data:', error)
        this.error = error instanceof Error ? error.message : String(error)
        this.projects = []
        this.audioFiles = []
        this.annotations = []
        throw error
      } finally {
        this.loading = false
      }
    },

    async saveAll() {
      this.loading = true
      this.error = null
      try {
        await storage.saveData({
          projects: this.projects,
          audioFiles: this.audioFiles,
          annotations: this.annotations,
          settings: {}
        })
      } catch (error) {
        console.error('Failed to save data:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    setCurrentProject(project: Project | null) {
      this.currentProject = project
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
        this.projects.push(project)
        await this.saveAll()
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
        const index = this.projects.findIndex(p => p.id === project.id)
        if (index > -1) {
          this.projects[index] = project
          await this.saveAll()
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
        const index = this.projects.findIndex(p => p.id === id)
        if (index > -1) {
          this.projects.splice(index, 1)
          // 删除相关的音频文件和标注
          this.audioFiles = this.audioFiles.filter(f => f.projectId !== id)
          const audioFileIds = this.audioFiles.map(f => f.id)
          this.annotations = this.annotations.filter(a => audioFileIds.includes(a.audioFileId))
          await this.saveAll()
          if (this.currentProject?.id === id) {
            this.currentProject = null
          }
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
      this.loading = true
      this.error = null
      try {
        this.audioFiles.push(audioFile)
        await this.saveAll()
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
      this.loading = true
      this.error = null
      try {
        const index = this.audioFiles.findIndex(f => f.id === audioFile.id)
        if (index > -1) {
          this.audioFiles[index] = audioFile
          await this.saveAll()
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
      this.loading = true
      this.error = null
      try {
        const index = this.audioFiles.findIndex(f => f.id === id)
        if (index > -1) {
          this.audioFiles.splice(index, 1)
          // 删除相关的标注
          this.annotations = this.annotations.filter(a => a.audioFileId !== id)
          await this.saveAll()
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
      this.loading = true
      this.error = null
      try {
        const index = this.annotations.findIndex(a => a.id === annotation.id)
        if (index > -1) {
          this.annotations[index] = annotation
        } else {
          this.annotations.push({
            ...annotation,
            id: crypto.randomUUID()
          })
        }
        await this.saveAll()
      } catch (error) {
        console.error('Failed to update annotation:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteAnnotation(id: string) {
      this.loading = true
      this.error = null
      try {
        const index = this.annotations.findIndex(a => a.id === id)
        if (index > -1) {
          this.annotations.splice(index, 1)
          await this.saveAll()
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
      this.loading = true
      this.error = null
      try {
        // 更新或添加每个标注
        for (const annotation of annotations) {
          const index = this.annotations.findIndex(a => a.id === annotation.id)
          if (index > -1) {
            this.annotations[index] = annotation
          } else {
            this.annotations.push(annotation)
          }
        }
        await this.saveAll()
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