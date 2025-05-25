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
    error: null,
  }),

  getters: {
    projectAudioFiles: (state): AudioFile[] => {
      return state.audioFiles
    },

    audioFileAnnotations: (state): Annotation[] => {
      const currentAudioFile = state.currentAudioFile
      if (!currentAudioFile) return []
      return state.annotations[currentAudioFile.id] || []
    },
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
          createdAt: project.createdAt
            ? new Date(project.createdAt)
            : new Date(),
          updatedAt: project.updatedAt
            ? new Date(project.updatedAt)
            : new Date(),
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
          createdAt: data.project.createdAt
            ? new Date(data.project.createdAt)
            : new Date(),
          updatedAt: data.project.updatedAt
            ? new Date(data.project.updatedAt)
            : new Date(),
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
          updatedAt: file.updatedAt ? new Date(file.updatedAt) : new Date(),
        }))

        // 更新标注
        const validatedAnnotations: Record<string, Annotation[]> = {}
        
        for (const audioId in data.annotations) {
          const audioFile = this.audioFiles.find(file => file.id === audioId)
          const audioDuration = audioFile?.duration || 0
          
          // 按开始时间排序
          const sortedAnnotations = [...data.annotations[audioId]].sort((a: Annotation, b: Annotation) => a.start - b.start)
          
          // 验证并过滤标注
          const validAnnotations = sortedAnnotations.filter((annotation: Annotation) => {
            // 舍弃长度为0或负的标注
            if (annotation.end <= annotation.start) {
              console.warn(`舍弃无效标注：时长为0或负值`,{annotation})
              return false
            }
            return true
          }).map((annotation: Annotation) => {
            // 校验开始时间和结束时间
            let { start, end } = annotation
            const originalStart = start
            const originalEnd = end
            
            // 开始时间不小于0
            if (start < 0) {
              start = 0
              console.warn(`调整标注开始时间：从 ${originalStart} 到 0`, {annotation})
            }
            
            // 结束时间不大于总时长
            if (end > audioDuration) {
              end = audioDuration
              console.warn(`调整标注结束时间：从 ${originalEnd} 到 ${audioDuration}`, {annotation})
            }
            
            return { ...annotation, start, end }
          })
          
          // 检查相邻标注是否有重叠
          for (let i = 0; i < validAnnotations.length - 1; i++) {
            const current = validAnnotations[i]
            const next = validAnnotations[i + 1]
            
            if (current.end > next.start) {
              console.warn(`检测到标注重叠：ID ${current.id} (${current.start}-${current.end}) 与 ID ${next.id} (${next.start}-${next.end})`, {current, next})
            }
          }
          
          validatedAnnotations[audioId] = validAnnotations
        }
        
        this.annotations = validatedAnnotations
      } catch (error) {
        console.error('Failed to load project:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async setCurrentProject(project: Project | null) {
      this.currentProject = project
      if (project) {
        this.loadProject(project.id)
      } else {
        this.audioFiles = []
        this.annotations = {}
        this.currentAudioFile = null
      }
    },

    async setCurrentAudioFile(audioFile: AudioFile | null) {
      this.currentAudioFile = audioFile
    },

    async createProject(
      name: string,
      description?: string,
      whisperApiUrl?: string
    ) {
      this.loading = true
      this.error = null
      try {
        const project: Project = {
          id: crypto.randomUUID(),
          name,
          description,
          whisperApiUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
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
        // 更新内存中的音频文件
        const index = this.audioFiles.findIndex(f => f.id === audioFile.id)
        if (index !== -1) {
          this.audioFiles[index] = audioFile
          if (this.currentAudioFile?.id === audioFile.id) {
            this.currentAudioFile = audioFile
          }

          // 保存到存储
          await storage.saveAudioFiles(audioFile.projectId, this.audioFiles)
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
            storage.saveAnnotations(this.currentProject.id, id, []),
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

        // 确保标注时间不超出音频时长
        const audioDuration = this.currentAudioFile.duration || 0
        const validAnnotation = {
          ...annotation,
          start: Math.max(0, Math.min(annotation.start, audioDuration)),
          end: Math.max(0, Math.min(annotation.end, audioDuration))
        }

        if (validAnnotation.end < validAnnotation.start) {
          // 确保 end 始终大于 start，否则交换
          let temp = validAnnotation.start
          validAnnotation.start = validAnnotation.end
          validAnnotation.end = temp
        } else if (validAnnotation.end === validAnnotation.start) {
          // 如果相等，则增加 0.1 秒
          validAnnotation.end = validAnnotation.start + 0.1
        }

        // 更新或添加标注
        const annotations = this.annotations[this.currentAudioFile.id]
        const index = annotations.findIndex(
          (a: Annotation) => a.id === validAnnotation.id
        )
        if (index > -1) {
          annotations[index] = validAnnotation
        } else {
          annotations.push({
            ...validAnnotation,
            id: crypto.randomUUID(),
          })
        }

        // 按开始时间排序标注
        annotations.sort((a, b) => a.start - b.start)

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

    async updateAnnotations(annotations: Annotation[]) {
      if (!this.currentProject || !this.currentAudioFile) {
        throw new Error('No project or audio file selected')
      }

      this.loading = true
      this.error = null
      try {
        // 确保标注时间不超出音频时长
        const audioDuration = this.currentAudioFile.duration || 0
        
        // 按开始时间排序标注
        const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start)
        
        // 验证并过滤标注
        const validAnnotations = sortedAnnotations.filter(annotation => {
          // 舍弃长度为0或负的标注
          if (annotation.end <= annotation.start) {
            console.warn(`舍弃无效标注：时长为0或负值 (ID: ${annotation.id}, 开始: ${annotation.start}, 结束: ${annotation.end})`)
            return false
          }
          return true
        }).map(annotation => {
          const originalStart = annotation.start
          const originalEnd = annotation.end
          
          // 开始时间不小于0
          let validStart = Math.max(0, annotation.start)
          if (validStart !== originalStart) {
            console.warn(`调整标注开始时间：从 ${originalStart} 到 ${validStart} (ID: ${annotation.id})`)
          }
          
          // 结束时间不大于总时长
          let validEnd = Math.min(annotation.end, audioDuration)
          if (validEnd !== originalEnd) {
            console.warn(`调整标注结束时间：从 ${originalEnd} 到 ${validEnd} (ID: ${annotation.id})`)
          }
          
          // 确保 end 始终大于 start
          if (validEnd <= validStart) {
            validEnd = Math.min(validStart + 0.1, audioDuration)
          }
          
          return {
            ...annotation,
            start: validStart,
            end: validEnd
          }
        })
        
        // 检查相邻标注是否有重叠
        for (let i = 0; i < validAnnotations.length - 1; i++) {
          const current = validAnnotations[i]
          const next = validAnnotations[i + 1]
          
          if (current.end > next.start) {
            console.warn(`检测到标注重叠：ID ${current.id} (${current.start}-${current.end}) 与 ID ${next.id} (${next.start}-${next.end})`)
          }
        }

        // 更新标注
        this.annotations[this.currentAudioFile.id] = validAnnotations

        // 保存更改
        await storage.saveAnnotations(
          this.currentProject.id,
          this.currentAudioFile.id,
          validAnnotations
        )
      } catch (error) {
        console.error('Failed to update annotations:', error)
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

    async clearAllAnnotations() {
      if (!this.currentProject || !this.currentAudioFile) {
        throw new Error('No project or audio file selected')
      }

      this.loading = true
      this.error = null
      try {
        // 清空标注数组
        this.annotations[this.currentAudioFile.id] = []

        // 保存更改
        await storage.saveAnnotations(
          this.currentProject.id,
          this.currentAudioFile.id,
          []
        )
      } catch (error) {
        console.error('Failed to clear annotations:', error)
        this.error = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async createAnnotation(annotationData: { start: number; end: number; text: string }) {
      this.updateAnnotation({
        ...annotationData,
        id: crypto.randomUUID(),
        audioFileId: this.currentAudioFile?.id || '',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    },
  },
})
