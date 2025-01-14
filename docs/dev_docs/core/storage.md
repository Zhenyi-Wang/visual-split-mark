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
  ├── uploads/             # 原始音频文件
  ├── converted/           # 转换后的 WAV 文件
  └── backups/            # 数据备份
```

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

### 设置管理

```typescript
// 保存全局设置
async saveSettings(settings: Record<string, string>): Promise<void>

// 加载全局设置
async loadSettings(): Promise<Record<string, string>>
```

### 备份管理

```typescript
// 创建备份
async createBackup(data: ProjectData): Promise<string>

// 从备份恢复
async restoreFromBackup(backupPath: string): Promise<ProjectData>

// 列出所有备份
async listBackups(): Promise<string[]>
```

## 命令行工具

项目提供了一些命令行工具来管理数据：

```bash
# 创建数据备份
yarn backup

# 列出所有备份
yarn backup:list

# 从备份恢复数据
BACKUP_PATH=storage/backups/backup-xxx.json yarn backup:restore
```

## 错误处理

所有的存储操作都包含错误处理机制：

1. 文件不存在时返回默认值
2. 写入失败时抛出异常
3. 数据格式错误时抛出异常

## 自动备份

在以下情况下会自动创建备份：

1. 保存项目数据时
2. 保存音频文件数据时
3. 保存标注数据时

## 最佳实践

1. 总是使用提供的 API 进行数据操作
2. 定期创建数据备份
3. 在进行重要操作前创建备份
4. 使用错误处理机制处理异常情况 