import type { Project } from '~/types/project'

export interface WhisperResult {
  text: string
  segments: Array<{
    start: number
    end: number
    text: string
  }>
}

export async function transcribeAudio(project: Project, audioBlob: Blob): Promise<WhisperResult> {
  if (!project.whisperApiUrl) {
    throw new Error('Whisper API URL not configured')
  }

  const formData = new FormData()
  formData.append('audio', audioBlob, 'audio.wav')

  const response = await fetch(project.whisperApiUrl, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Whisper API error: ${response.statusText}`)
  }

  return response.json()
} 