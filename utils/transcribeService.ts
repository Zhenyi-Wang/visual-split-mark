import type { Project } from '~/types/project'

export interface TranscribeServiceBody {
  from: number
  to: number
  sid: number
  content: string
  location: number
  music: number
}

export interface TranscribeServiceResult {
  status: 'success' | 'error'
  message?: string
  body: TranscribeServiceBody[]
  lang: string
  audio_duration: number
  processing_time: number
  rtf: number
}

export interface TranscribeSegment {
  start: number
  end: number
  text: string
}

export function convertTranscribeResult(result: TranscribeServiceResult): TranscribeSegment[] {
  if (result.status === 'error') {
    throw new Error(result.message || '转录服务返回错误')
  }

  return result.body.map(item => ({
    start: item.from,
    end: item.to,
    text: item.content.trim()
  })).filter(seg => seg.text.length > 0)
}

export async function callTranscribeService(
  project: Project,
  audioPath: string
): Promise<TranscribeServiceResult> {
  if (!project.transcribeApiUrl) {
    throw new Error('转录服务 API 地址未配置')
  }

  const response = await fetch('/api/transcribe-service/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      audioPath,
      transcribeApiUrl: project.transcribeApiUrl,
      transcribeApiToken: project.transcribeApiToken
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
