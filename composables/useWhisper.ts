export interface WhisperSegment {
  start: number
  end: number
  text: string
}

export interface WhisperResult {
  segments: WhisperSegment[]
}

export async function transcribeWithWhisper(audioPath: string, apiUrl: string): Promise<WhisperResult> {
  if (!apiUrl) {
    throw new Error('Whisper API 地址未配置')
  }

  const response = await fetch('/api/whisper/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      audioPath,
      whisperApiUrl: apiUrl,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText)
  }

  return response.json()
}
