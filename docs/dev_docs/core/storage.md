# 数据存储模块

## 概述

数据存储模块负责管理应用的所有持久化数据，包括项目信息、音频文件和标注数据。该模块使用 JSON 文件作为存储介质，并提供自动备份功能。

## 数据结构

```typescript
// 项目数据
interface ProjectData {
  projects: Project[];        // 项目列表
  audioFiles: AudioFile[];    // 音频文件列表
  annotations: Annotation[];  // 标注列表
  settings: Record<string, string>; // 全局设置
  version: string;           // 数据版本
  lastBackup?: string;      // 最后备份时间
}
```

## 文件结构

```
storage/
  ├── data/
  │   ├── projects.json     # 项目数据
  │   └── settings.json     # 全局设置
  ├── uploads/             # 原始音频文件（使用随机ID命名）
  ├── converted/           # 转换后的 WAV 文件（使用随机ID命名）
  └── backups/            # 数据备份
```

## 文件命名规则

1. 原始音频文件：
   - 路径格式：`storage/uploads/{随机ID}.mp3`
   - 原始文件名保存在数据库的 `originalName` 字段中

2. 转换后的 WAV 文件：
   - 路径格式：`storage/converted/{随机ID}.wav`
   - 使用 16kHz 采样率、单声道、16位 PCM 格式
   - 格式针对 Whisper 模型优化

## API

### 项目管理

```typescript
// 保存项目列表
async saveProjects(projects: Project[]): Promise<void>

// 加载项目列表
async loadProjects(): Promise<Project[]>
```

### 音频文件管理

```typescript
// 保存音频文件列表
async saveAudioFiles(files: AudioFile[]): Promise<void>

// 加载音频文件列表
async loadAudioFiles(): Promise<AudioFile[]>
```

### 标注管理

```typescript
// 保存标注列表
async saveAnnotations(annotations: Annotation[]): Promise<void>

// 加载标注列表
async loadAnnotations(): Promise<Annotation[]>
```

### 备份管理

```typescript
// 创建备份
async createBackup(): Promise<string>

// 从备份恢复
async restoreFromBackup(backupPath: string): Promise<void>

// 列出所有备份
async listBackups(): Promise<string[]>
```

## 最佳实践

1. 文件命名
   - 使用随机 ID 作为文件名，避免冲突和特殊字符问题
   - 原始文件名保存在数据库中，用于显示

2. 目录结构
   - 原始文件和转换后的文件分开存储
   - 使用不同目录便于管理和备份

3. 音频格式
   - WAV 文件使用 Whisper 模型推荐的格式
   - 16kHz 采样率、单声道、16位 PCM

4. 错误处理
   - 文件操作需要适当的错误处理
   - 保持数据库和文件系统的一致性

5. 备份策略
   - 定期创建数据备份
   - 备份包含数据库和音频文件 