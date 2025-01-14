# 音频文件管理

## 数据结构

```typescript
interface AudioFile {
  id: string;              // 文件ID
  projectId: string;       // 所属项目ID
  originalName: string;    // 原始文件名
  originalPath: string;    // 原始文件路径
  wavPath: string;        // WAV文件路径
  duration: number;       // 音频时长（秒）
  status: 'uploaded' | 'converting' | 'ready' | 'error'; // 文件状态
}
```

## 文件存储

- 原始文件：`storage/uploads/{id}.mp3`
- 转换文件：`storage/converted/{id}.wav`
- 项目数据：`storage/data/audio_files.json`

## 状态管理

```typescript
interface AudioState {
  audioFiles: AudioFile[];         // 音频文件列表
  currentAudioFile: AudioFile | null; // 当前音频文件
  loading: boolean;                // 加载状态
  error: string | null;           // 错误信息
}

interface AudioActions {
  // 加载音频文件列表
  loadAudioFiles(): Promise<void>;

  // 添加音频文件
  addAudioFile(file: File): Promise<AudioFile>;

  // 更新音频文件
  updateAudioFile(file: AudioFile): Promise<void>;

  // 删除音频文件
  deleteAudioFile(id: string): Promise<void>;
}
```

## 注意事项

1. 文件命名
   - 使用随机ID作为文件名
   - 原始文件名保存在数据中

2. 音频格式
   - 输入支持MP3格式
   - 转换为16kHz单声道WAV格式

3. 错误处理
   - 文件上传失败
   - 格式转换失败
   - 文件不存在 