# Whisper API 集成

本模块负责与 Whisper API 的集成，提供音频文本识别功能。支持自定义 API 端点，可以使用 OpenAI 的官方 API 或自托管的 Whisper 服务。

## 配置接口

```typescript
interface WhisperConfig {
  apiEndpoint: string
  apiKey?: string
  language?: string
  task?: 'transcribe' | 'translate'
  model?: string
  temperature?: number
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
}
```

## 核心类

```typescript
class WhisperService {
  private config: WhisperConfig

  constructor(config: WhisperConfig) {
    this.config = {
      language: 'zh',
      task: 'transcribe',
      model: 'base',
      temperature: 0,
      responseFormat: 'json',
      ...config
    }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('language', this.config.language!)
    formData.append('task', this.config.task!)
    formData.append('model', this.config.model!)
    formData.append('temperature', this.config.temperature!.toString())
    formData.append('response_format', this.config.responseFormat!)

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: this.config.apiKey ? {
        'Authorization': `Bearer ${this.config.apiKey}`
      } : undefined,
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.text
  }
}
```

## 使用示例

1. **初始化服务**
```typescript
const whisperService = new WhisperService({
  apiEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
  apiKey: 'your-api-key',
  language: 'zh',
  model: 'base'
})
```

2. **识别音频**
```typescript
try {
  const text = await whisperService.transcribe(audioBlob)
  console.log('识别结果:', text)
} catch (error) {
  console.error('识别失败:', error)
}
```

3. **批量处理**
```typescript
async function transcribeSegments(segments: AudioSegment[]): Promise<void> {
  for (const segment of segments) {
    try {
      const text = await whisperService.transcribe(segment.audioBlob)
      segment.whisperText = text
    } catch (error) {
      console.error(`段落 ${segment.id} 识别失败:`, error)
      segment.whisperText = null
    }
  }
}
```

## 错误处理

1. **API 错误**
```typescript
class WhisperAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response: any
  ) {
    super(message)
    this.name = 'WhisperAPIError'
  }
}

async transcribe(audioBlob: Blob): Promise<string> {
  try {
    // ... API 调用代码 ...
  } catch (error) {
    if (error instanceof Response) {
      const errorData = await error.json()
      throw new WhisperAPIError(
        errorData.message || error.statusText,
        error.status,
        errorData
      )
    }
    throw error
  }
}
```

2. **重试机制**
```typescript
async transcribeWithRetry(
  audioBlob: Blob,
  maxRetries = 3,
  delay = 1000
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.transcribe(audioBlob)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}
```

## 性能优化

1. **并发控制**
```typescript
class WhisperService {
  private concurrentLimit = 3
  private queue: Array<() => Promise<void>> = []
  private running = 0

  private async processQueue() {
    if (this.running >= this.concurrentLimit) return
    if (this.queue.length === 0) return

    this.running++
    const task = this.queue.shift()!
    try {
      await task()
    } finally {
      this.running--
      this.processQueue()
    }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this._transcribe(audioBlob)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.processQueue()
    })
  }
}
```

2. **缓存结果**
```typescript
class WhisperService {
  private cache = new Map<string, string>()

  async transcribe(audioBlob: Blob): Promise<string> {
    const hash = await this.hashAudio(audioBlob)
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!
    }

    const text = await this._transcribe(audioBlob)
    this.cache.set(hash, text)
    return text
  }

  private async hashAudio(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}
```

## 配置示例

1. **OpenAI API**
```typescript
const openaiWhisper = new WhisperService({
  apiEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'whisper-1',
  language: 'zh'
})
```

2. **自托管服务**
```typescript
const selfHostedWhisper = new WhisperService({
  apiEndpoint: 'http://localhost:9000/transcribe',
  model: 'base.en',
  language: 'en'
})
```

## 测试

1. **单元测试**
```typescript
describe('WhisperService', () => {
  let service: WhisperService

  beforeEach(() => {
    service = new WhisperService({
      apiEndpoint: 'http://test-api.local',
      apiKey: 'test-key'
    })
  })

  it('should transcribe audio', async () => {
    const blob = new Blob(['test'], { type: 'audio/wav' })
    const result = await service.transcribe(blob)
    expect(result).toBe('测试文本')
  })

  it('should handle API errors', async () => {
    // ... 错误处理测试 ...
  })
})
```

2. **集成测试**
```typescript
describe('Whisper Integration', () => {
  it('should transcribe real audio', async () => {
    const audioFile = await loadTestAudio('test.wav')
    const text = await whisperService.transcribe(audioFile)
    expect(text).toMatch(/[\u4e00-\u9fa5]+/) // 包含中文字符
  })
})
```

## 最佳实践

1. **音频预处理**
   - 确保音频格式正确
   - 控制音频长度
   - 优化音频质量

2. **错误处理**
   - 实现重试机制
   - 提供错误反馈
   - 记录错误日志

3. **性能优化**
   - 控制并发请求
   - 缓存识别结果
   - 优化请求大小

## 相关文档

- [Whisper API 文档](https://platform.openai.com/docs/api-reference/audio)
- [音频处理](./audio.md)
- [状态管理](./state.md)
- [测试指南](../testing/README.md) 