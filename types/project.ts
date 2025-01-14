export interface Project {
  id: string
  name: string
  description?: string
}

export interface AudioFile {
  id: string
  projectId: string
  originalName: string
  originalPath: string
  wavPath: string
  duration: number
  status: 'uploaded' | 'converting' | 'ready' | 'error'
}

export interface Annotation {
  id: string
  audioFileId: string
  start: number
  end: number
  text: string
  whisperText?: string
} 