# 音频处理模块

音频处理模块是 Visual Split Mark 的核心功能之一，负责音频文件的转码、分割和时长获取等操作。本模块主要基于 FFmpeg.js 实现。

## 核心类：AudioProcessor

`AudioProcessor` 类封装了所有音频处理相关的功能，位于 `utils/audio.ts`。

### 初始化

```typescript
class AudioProcessor {
  private ffmpeg: FFmpeg | null = null
  private isLoaded = false
  private baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

  async load() {
    if (this.isLoaded) return

    this.ffmpeg = new FFmpeg()
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${this.baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${this.baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    })

    this.isLoaded = true
  }
}
```

### 主要功能

1. **音频转码** (`convertToWav`)
   - 将 MP3 文件转换为 16KHz 单声道 WAV 格式
   - 支持进度回调
   - 自动清理临时文件

```typescript
async convertToWav(
  inputFile: File, 
  progressCallback?: (progress: number) => void
): Promise<Blob>
```

2. **获取音频时长** (`getAudioDuration`)
   - 使用 FFprobe 命令获取音频文件时长
   - 从输出日志中解析时长信息

```typescript
async getAudioDuration(file: File): Promise<number>
```

3. **音频分割** (`extractSegment`)
   - 从 WAV 文件中提取指定时间段的音频
   - 保持原始音频格式和质量

```typescript
async extractSegment(
  audioBlob: Blob, 
  start: number, 
  end: number
): Promise<Blob>
```

## 使用示例

1. **初始化**
```typescript
import { audioProcessor } from '~/utils/audio'

// 在使用其他功能前先加载 FFmpeg
await audioProcessor.load()
```

2. **转换音频**
```typescript
const mp3File = new File([...], 'input.mp3', { type: 'audio/mp3' })
const wavBlob = await audioProcessor.convertToWav(mp3File, (progress) => {
  console.log(`转换进度: ${progress * 100}%`)
})
```

3. **获取时长**
```typescript
const duration = await audioProcessor.getAudioDuration(mp3File)
console.log(`音频时长: ${duration} 秒`)
```

4. **分割音频**
```typescript
const segment = await audioProcessor.extractSegment(wavBlob, 10, 20)
// 提取 10-20 秒的片段
```

## 注意事项

1. **内存管理**
   - FFmpeg.js 在浏览器中运行，注意内存使用
   - 及时清理不再需要的文件
   - 避免同时处理多个大文件

2. **错误处理**
   - 所有方法都可能抛出异常
   - 建议使用 try-catch 包装所有调用
   - 提供用户友好的错误提示

3. **性能优化**
   - 转码和分割是耗时操作
   - 建议显示进度条和取消选项
   - 考虑使用 Web Worker

## 常见问题

1. **FFmpeg 加载失败**
   - 检查网络连接
   - 确保 CDN 可访问
   - 考虑本地托管 FFmpeg 文件

2. **内存溢出**
   - 限制同时处理的文件数量
   - 分批处理大文件
   - 及时释放资源

3. **格式兼容性**
   - 目前仅支持 MP3 输入
   - 输出固定为 16KHz WAV
   - 需要其他格式请提交 issue

## 开发计划

1. **短期**
   - 添加更多音频格式支持
   - 优化转码性能
   - 添加音频预览功能

2. **中期**
   - 实现音频流处理
   - 添加音频效果处理
   - 优化内存使用

3. **长期**
   - 支持服务器端处理
   - 实现实时转码
   - 添加批处理功能

## 相关文档

- [FFmpeg.js 文档](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [音频文件规范](../api/audio.md)
- [状态管理](../store/audio.md) 