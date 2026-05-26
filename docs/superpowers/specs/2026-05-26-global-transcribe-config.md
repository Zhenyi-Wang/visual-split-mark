# 全局转录配置 + 识别文本移至项目页

## 背景

当前转录服务配置（whisperApiUrl、transcribeApiUrl、transcribeApiToken）存储在每个 Project 级别，所有项目需要单独配置。"识别文本"功能仅在 `project-dom-annotation` 标注页可用，用户必须先加载音频进入标注界面才能发起转录。

实际使用中所有项目共用同一个转录服务，且识别应该在音频文件列表页直接操作，无需进入标注页。

## 目标

1. 将转录服务配置从 Project 级别提升到全局级别，所有项目共用一份配置
2. 将"识别文本"功能从 `project-dom-annotation` 页面移到 `/project/[id]` 页面
3. 只有标注数量为 0 的音频文件才能发起识别

## 变更范围

### 1. 数据层

**`storage/settings/global.json`** 新增字段：

```json
{
  "id": "global",
  "transcribeType": "none",
  "whisperApiUrl": "",
  "transcribeApiUrl": "",
  "transcribeApiToken": "",
  "updatedAt": "..."
}
```

- `transcribeType`: `"whisper"` | `"transcribeService"` | `"none"`
- `whisperApiUrl`: Whisper API 地址（仅 transcribeType 为 whisper 时使用）
- `transcribeApiUrl`: 转录服务 API 地址
- `transcribeApiToken`: 转录服务认证 Token（可选）

**`types/project.ts`**：`Project` 接口移除 `whisperApiUrl`、`transcribeApiUrl`、`transcribeApiToken` 三个字段。

### 2. 后端 API

新增两个端点操作 `storage/settings/global.json`：

- `GET /api/settings/load` — 返回全局配置
- `POST /api/settings/save` — 接收并保存全局配置

### 3. 前端 composable

新增 `composables/useSettings.ts`：

- `settings`: 响应式全局配置状态（单例，全局共享）
- `loadSettings()`: 从后端加载配置（带缓存，已加载过则跳过）
- `saveSettings(data)`: 保存配置到后端并更新本地状态

初始化时机：在 `pages/index.vue` 的 `onMounted` 中调用 `loadSettings()`，确保进入任何需要转录配置的页面前配置已加载。项目页 `pages/project/[id].vue` 的 `onMounted` 中也调用一次确保可用。

`pages/index.vue`：

- 顶部按钮区新增"设置"按钮
- 点击弹出 Modal，包含转录服务类型选择（Whisper API / 转录服务 / 不配置）和对应的配置字段
- 创建/编辑项目的 Modal 移除转录配置相关表单项

### 5. 识别文本移至 `/project/[id].vue`

`pages/project/[id].vue`：

- 每个音频文件行新增"识别"按钮
- 按钮仅在 `getAnnotationCount(file.id) === 0` 时启用，标注数 > 0 时按钮显示但 disabled
- 点击弹出确认对话框，确认后执行：先调用 `projectStore.setCurrentAudioFile(file)` 设置上下文，再调用转录服务，最后调用 `projectStore.updateAnnotations(annotations)` 保存结果
- 识别完成后界面刷新显示标注数量
- 识别进行中该行显示 loading 状态（`transcribingFileId` ref 追踪当前正在识别的文件 ID）

`pages/project-dom-annotation/[projectId]/[audioId]/index.vue`：

- 移除"识别文本"按钮
- 移除 `useWhisper` / `useTranscribeService` 引用
- 移除相关的 `transcribing`、`showTranscribeConfirmModal`、`showTranscribeResultModal`、`transcribeResult`、`handleTranscribe`、`handleConfirmTranscribe` 等状态和处理函数
- 移除对应的两个 Modal 模板

### 6. 转录 composable 改造

`composables/useWhisper.ts` 和 `composables/useTranscribeService.ts`：

- 不再从 `projectStore.currentProject` 读取 API 配置
- 改为纯函数式调用：各自暴露一个 `transcribe(audioPath: string, config: { apiUrl: string, apiToken?: string })` 函数，直接调用对应后端 API 并返回识别结果数组（`TranscribeSegment[]`）
- 不再在 composable 内部调用 `projectStore.updateAnnotations()`，由调用方负责保存
- 路由逻辑放在调用方（`pages/project/[id].vue`）：根据全局 `settings.transcribeType` 决定调用 `useWhisper` 还是 `useTranscribeService`

### 7. Store 清理

`stores/project.ts`：

- `createProject` 方法移除 `whisperApiUrl`、`transcribeApiUrl`、`transcribeApiToken` 参数
- `updateProject` 方法同步调整

### 8. 数据迁移

`storage/settings/global.json` 已存在且包含旧字段 `whisperApiUrl`。迁移策略：`GET /api/settings/load` 读取时自动合并默认值，无需独立迁移脚本。旧字段 `whisperApiUrl` 保留，新增 `transcribeType`、`transcribeApiUrl`、`transcribeApiToken`。

各项目 `project.json` 中的 `whisperApiUrl`、`transcribeApiUrl`、`transcribeApiToken` 字段不删除（避免数据丢失），但代码中不再读取这些字段。

## 不涉及的变更

- 标注页（project-dom-annotation）的其他功能不受影响
- 音频上传、转换、删除流程不变
- 导出功能不变
- 批量查找替换功能不变
