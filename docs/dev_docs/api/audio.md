# 音频处理 API

## 文件上传

### POST /api/file/save

分块上传音频文件。

**请求参数**

```typescript
{
  path: string       // 保存路径，格式：storage/uploads/{随机ID}.mp3
  data: Uint8Array   // 文件数据块
  isFirstChunk: boolean  // 是否为第一块
  isLastChunk: boolean   // 是否为最后一块
}
```

**响应**

```typescript
{
  success: boolean   // 是否成功
  error?: string    // 错误信息
}
```

## 格式转换

### POST /api/file/convert

将 MP3 文件转换为 WAV 格式。

**请求参数**

```typescript
{
  inputPath: string   // 输入文件路径，格式：storage/uploads/{随机ID}.mp3
  outputPath: string  // 输出文件路径，格式：storage/converted/{随机ID}.wav
}
```

**响应**

```typescript
{
  success: boolean   // 是否成功
  error?: string    // 错误信息
}
```

## 文件删除

### POST /api/file/delete

删除音频文件。

**请求参数**

```typescript
{
  path: string      // 文件路径
}
```

**响应**

```typescript
{
  success: boolean   // 是否成功
  error?: string    // 错误信息
}
```

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 404 | 文件不存在 |
| 500 | 服务器内部错误 |

## 注意事项

1. 文件命名
   - 使用随机 ID 作为文件名
   - 原始文件名保存在数据库中
   - 避免使用特殊字符

2. 文件大小
   - 单个分块建议不超过 5MB
   - 总文件大小限制为 500MB

3. 文件格式
   - 仅支持 MP3 格式输入
   - 转换后的 WAV 文件参数：
     - 采样率：16kHz
     - 声道数：单声道
     - 编码：16位 PCM

4. 安全性
   - 验证文件类型
   - 检查文件大小
   - 限制上传频率

5. 错误处理
   - 详细的错误日志
   - 友好的错误提示
   - 支持重试机制 