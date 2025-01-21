import type { Project } from '~/types/project'

export interface WhisperResult {
  segments: Array<{
    start: number
    end: number
    text: string
  }>
}

export async function transcribeAudio(project: Project, audioPath: string): Promise<WhisperResult> {
  if (!project.whisperApiUrl) {
    throw new Error('Whisper API URL not configured')
  }

  const response = await fetch('/api/whisper/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      audioPath,
      whisperApiUrl: project.whisperApiUrl
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText)
  }

  return response.json()
} 