export interface Project {
  id: string
  name: string
  description?: string
  whisperApiUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface AudioFile {
  id: string
  projectId: string
  originalName: string
  originalPath: string
  wavPath: string
  duration: number
  status: 'uploaded' | 'converting' | 'ready' | 'error'
  createdAt: Date
  updatedAt: Date
}

export interface Annotation {
  id: string
  audioFileId: string
  start: number
  end: number
  text: string
  whisperText?: string
  createdAt: Date
  updatedAt: Date
} 