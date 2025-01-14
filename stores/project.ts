import { defineStore } from 'pinia'
import type { Project, AudioFile, Annotation } from '~/types/project'
import { storage } from '~/utils/storage'

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [] as Project[],
    currentProject: null as Project | null,
    audioFiles: [] as AudioFile[],
    currentAudioFile: null as AudioFile | null,
    annotations: [] as Annotation[],
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
        const [projects, audioFiles, annotations] = await Promise.all([
          storage.loadProjects(),
          storage.loadAudioFiles(),
          storage.loadAnnotations()
        ])
        this.projects = projects
        this.audioFiles = audioFiles
        this.annotations = annotations
      } catch (error) {
        console.error('Failed to initialize store:', error)
        this.error = error instanceof Error ? error.message : String(error)
      } finally {
        this.loading = false
      }
    },

    async createProject(name: string, description?: string) {
      this.loading = true
      this.error = null

      try {
        const project: Project = {
          id: crypto.randomUUID(),
          name,
          description,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        this.projects.push(project)
        await storage.saveProjects(this.projects)
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
          this.projects[index] = {
            ...project,
            updatedAt: new Date()
          }
          await storage.saveProjects(this.projects)
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
          
          await Promise.all([
            storage.saveProjects(this.projects),
            storage.saveAudioFiles(this.audioFiles),
            storage.saveAnnotations(this.annotations)
          ])

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
        await storage.saveAudioFiles(this.audioFiles)
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
          this.audioFiles[index] = {
            ...audioFile,
            updatedAt: new Date()
          }
          await storage.saveAudioFiles(this.audioFiles)
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
          
          await Promise.all([
            storage.saveAudioFiles(this.audioFiles),
            storage.saveAnnotations(this.annotations)
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
      this.loading = true
      this.error = null

      try {
        const index = this.annotations.findIndex(a => a.id === annotation.id)
        if (index > -1) {
          this.annotations[index] = {
            ...annotation,
            updatedAt: new Date()
          }
        } else {
          this.annotations.push({
            ...annotation,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
        await storage.saveAnnotations(this.annotations)
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
          await storage.saveAnnotations(this.annotations)
        }
      } catch (error) {
        console.error('Failed to delete annotation:', error)
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
    }
  }
}) 