# 存储管理

## 数据结构

```typescript
interface Settings {
  version: string;         // 数据版本
}

interface StorageData {
  projects: Project[];     // 项目列表
  audioFiles: AudioFile[]; // 音频文件列表
  annotations: Annotation[]; // 标注列表
  settings: Settings;      // 设置
}
```

## 目录结构

```
storage/
  ├── data/              # 项目数据
  │   ├── projects.json       # 项目数据
  │   ├── audio_files.json    # 音频文件数据
  │   ├── annotations.json    # 标注数据
  │   └── settings.json       # 设置
  ├── uploads/           # 原始音频文件
  └── converted/         # 转换后的音频文件
```

## API

### 数据管理

```typescript
interface Storage {
  // 保存数据
  async saveData(data: StorageData): Promise<void>

  // 加载数据
  async loadData(): Promise<StorageData>
}
```

### 文件管理

```typescript
interface Storage {
  // 保存上传的文件
  async saveUploadedFile(file: File): Promise<string>

  // 保存转换后的文件
  async saveConvertedFile(file: File): Promise<string>

  // 删除文件
  async deleteFile(path: string): Promise<void>
}
```

## 注意事项

1. 文件命名
   - 使用随机ID作为文件名
   - 原始文件名保存在数据中

2. 数据存储
   - 使用JSON格式存储
   - 定期清理不需要的文件 