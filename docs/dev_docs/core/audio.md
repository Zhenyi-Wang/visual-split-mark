# 音频处理模块

音频处理模块是 Visual Split Mark 的核心功能之一，负责音频文件的转码、分割和时长获取等操作。本模块基于服务器端 FFmpeg 实现。

## 音频转换

### 转换流程

1. 文件上传
   - 原始文件使用随机 ID 命名
   - 保存到 `storage/uploads` 目录

2. 格式转换
   - 使用服务器端 FFmpeg 进行转换
   - 输出保存到 `storage/converted` 目录
   - 使用随机 ID 命名

### 转换参数

转换参数针对 Whisper 模型优化：

```bash
ffmpeg -i input.mp3 \
  -ar 16000 \    # 采样率 16kHz
  -ac 1 \        # 单声道
  -c:a pcm_s16le # 16位 PCM
  output.wav
```

参数说明：
- 采样率 16kHz：符合 Whisper 模型的训练数据格式
- 单声道：语音识别不需要空间音频信息
- 16位 PCM：无损格式，保证音频质量

## API 接口

### 文件上传

```typescript
// 上传文件
POST /api/file/save
Body: {
  path: string       // 保存路径
  data: Uint8Array   // 文件数据
  isFirstChunk: boolean
  isLastChunk: boolean
}
```

### 格式转换

```typescript
// 转换格式
POST /api/file/convert
Body: {
  inputPath: string  // 输入文件路径
  outputPath: string // 输出文件路径
}
```

### 文件删除

```typescript
// 删除文件
POST /api/file/delete
Body: {
  path: string      // 文件路径
}
```

## 错误处理

1. 文件上传
   - 检查文件类型
   - 验证文件大小
   - 确保目录存在

2. 格式转换
   - 检查输入文件存在
   - 监控转换进程
   - 捕获 FFmpeg 错误

3. 文件删除
   - 检查文件存在
   - 确保权限正确

## 状态管理

音频文件状态：
- `uploaded`: 文件已上传
- `converting`: 正在转换
- `ready`: 转换完成
- `error`: 转换失败

## 最佳实践

1. 文件命名
   - 使用随机 ID 避免冲突
   - 原始文件名保存在数据库

2. 错误处理
   - 详细的错误日志
   - 适当的用户提示

3. 性能优化
   - 服务器端转换减轻浏览器负担
   - 分块上传大文件

4. 安全性
   - 验证文件类型
   - 限制文件大小
   - 安全的文件命名 