export interface TranscribeSegment {
  start: number
  end: number
  text: string
}

interface TranscribeServiceBody {
  from: number
  to: number
  content: string
}

interface TranscribeServiceResult {
  status: 'success' | 'error'
  message?: string
  body: TranscribeServiceBody[]
}

export async function transcribeWithService(
  audioPath: string,
  apiUrl: string,
  apiToken?: string
): Promise<TranscribeSegment[]> {
  if (!apiUrl) {
    throw new Error('转录服务 API 地址未配置')
  }

  const response = await fetch('/api/transcribe-service/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      audioPath,
      transcribeApiUrl: apiUrl,
      transcribeApiToken: apiToken,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText)
  }

  const result: TranscribeServiceResult = await response.json()

  if (result.status === 'error') {
    throw new Error(result.message || '转录服务返回错误')
  }

  return result.body
    .map(item => ({
      start: item.from,
      end: item.to,
      text: item.content.trim(),
    }))
    .filter(seg => seg.text.length > 0)
}
