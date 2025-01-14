# 音频状态管理

## 数据结构

### AudioFile

```typescript
interface AudioFile {
  id: string           // 文件唯一标识
  projectId: string    // 所属项目 ID
  originalName: string // 原始文件名
  originalPath: string // 原始文件路径 storage/uploads/{随机ID}.mp3
  wavPath: string      // WAV 文件路径 storage/converted/{随机ID}.wav
  status: AudioStatus  // 文件状态
  duration?: number    // 音频时长（秒）
  error?: string      // 错误信息
}
```

### AudioStatus

```typescript
type AudioStatus = 'uploaded' | 'converting' | 'ready' | 'error'
```

## 状态管理

### 状态流转

1. 文件上传
   - 初始状态：`uploaded`
   - 上传完成后开始转换

2. 格式转换
   - 转换中：`converting`
   - 转换完成：`ready`
   - 转换失败：`error`

### 错误处理

1. 上传错误
   - 网络错误
   - 文件大小超限
   - 格式不支持

2. 转换错误
   - FFmpeg 错误
   - 磁盘空间不足
   - 权限问题

## 数据持久化

1. 文件存储
   - 原始文件：`storage/uploads/{随机ID}.mp3`
   - WAV 文件：`storage/converted/{随机ID}.wav`

2. 元数据存储
   - 项目数据：`storage/projects/{projectId}.json`
   - 备份数据：`storage/backups/{timestamp}.json`

## 最佳实践

1. 状态更新
   - 及时更新状态
   - 避免状态不一致
   - 保持数据同步

2. 错误恢复
   - 支持重试机制
   - 清理失败文件
   - 记录错误日志

3. 性能优化
   - 避免频繁状态更新
   - 批量处理状态变更
   - 缓存常用数据 