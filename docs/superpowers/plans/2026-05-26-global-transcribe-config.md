# 全局转录配置 + 识别文本移至项目页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将转录服务配置提升到全局级别，并将"识别文本"功能从标注页移到项目详情页，仅对零标注音频开放。

**Architecture:** 新增全局设置 API + useSettings composable，改造 useWhisper/useTranscribeService 为纯函数，在项目页增加识别按钮，从标注页移除识别相关代码。

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Naive UI, Pinia, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/api/settings/load.get.ts` | 读取全局配置 |
| Create | `server/api/settings/save.post.ts` | 保存全局配置 |
| Create | `composables/useSettings.ts` | 全局配置响应式状态管理 |
| Modify | `types/project.ts` | 移除 Project 上的转录配置字段 |
| Modify | `composables/useWhisper.ts` | 改为纯函数，接收 config 参数 |
| Modify | `composables/useTranscribeService.ts` | 改为纯函数，接收 config 参数 |
| Modify | `pages/index.vue` | 增加设置按钮和 Modal，移除项目编辑中的转录配置 |
| Modify | `pages/project/[id].vue` | 增加识别按钮和相关逻辑 |
| Modify | `pages/project-dom-annotation/[projectId]/[audioId]/index.vue` | 移除识别相关代码 |
| Modify | `stores/project.ts` | createProject/updateProject 移除转录参数 |

---

### Task 1: 后端 — 全局设置 API

**Files:**
- Create: `server/api/settings/load.get.ts`
- Create: `server/api/settings/save.post.ts`

- [ ] **Step 1: 创建 load.get.ts**

```typescript
// server/api/settings/load.get.ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const SETTINGS_PATH = join(process.cwd(), 'storage/settings/global.json')

const DEFAULT_SETTINGS = {
  id: 'global',
  transcribeType: 'none',
  whisperApiUrl: '',
  transcribeApiUrl: '',
  transcribeApiToken: '',
}

export default defineEventHandler(async () => {
  try {
    const content = await readFile(SETTINGS_PATH, 'utf-8')
    const saved = JSON.parse(content)
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return DEFAULT_SETTINGS
  }
})
```

- [ ] **Step 2: 创建 save.post.ts**

```typescript
// server/api/settings/save.post.ts
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

const SETTINGS_PATH = join(process.cwd(), 'storage/settings/global.json')

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const settings = {
    id: 'global',
    transcribeType: body.transcribeType || 'none',
    whisperApiUrl: body.whisperApiUrl || '',
    transcribeApiUrl: body.transcribeApiUrl || '',
    transcribeApiToken: body.transcribeApiToken || '',
    updatedAt: new Date().toISOString(),
  }

  await mkdir(dirname(SETTINGS_PATH), { recursive: true })
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2))

  return { success: true, settings }
})
```

- [ ] **Step 3: 验证 API 可用**

Run: `npx nuxi build 2>&1 | tail -5`（确认无构建错误，后续 task 一起验证即可，此处不单独运行）

---

### Task 2: 前端 — useSettings composable

**Files:**
- Create: `composables/useSettings.ts`

- [ ] **Step 1: 创建 useSettings.ts**

```typescript
// composables/useSettings.ts
export interface GlobalSettings {
  id: string
  transcribeType: 'whisper' | 'transcribeService' | 'none'
  whisperApiUrl: string
  transcribeApiUrl: string
  transcribeApiToken: string
  updatedAt?: string
}

const settings = ref<GlobalSettings>({
  id: 'global',
  transcribeType: 'none',
  whisperApiUrl: '',
  transcribeApiUrl: '',
  transcribeApiToken: '',
})

const loaded = ref(false)

export function useSettings() {
  const loadSettings = async () => {
    if (loaded.value) return
    try {
      const data = await $fetch<GlobalSettings>('/api/settings/load')
      settings.value = data
      loaded.value = true
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async (data: Partial<GlobalSettings>) => {
    try {
      const result = await $fetch<{ success: boolean; settings: GlobalSettings }>('/api/settings/save', {
        method: 'POST',
        body: data,
      })
      if (result.settings) {
        settings.value = result.settings
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      throw error
    }
  }

  const isTranscribeConfigured = computed(
    () => settings.value.transcribeType !== 'none'
      && (settings.value.transcribeType === 'whisper' ? !!settings.value.whisperApiUrl : !!settings.value.transcribeApiUrl)
  )

  return {
    settings: readonly(settings),
    loadSettings,
    saveSettings,
    isTranscribeConfigured,
  }
}
```

---

### Task 3: 类型 — 移除 Project 上的转录配置字段

**Files:**
- Modify: `types/project.ts`

- [ ] **Step 1: 从 Project 接口移除三个字段**

将：

```typescript
export interface Project {
  id: string
  name: string
  description?: string
  whisperApiUrl?: string
  transcribeApiUrl?: string
  transcribeApiToken?: string
  createdAt: Date
  updatedAt: Date
}
```

改为：

```typescript
export interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 2: 更新 stores/project.ts — createProject 方法**

将 `createProject` 方法签名和内部逻辑移除三个参数：

```typescript
async createProject(
  name: string,
  description?: string
) {
  this.loading = true
  this.error = null
  try {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await storage.saveProject(project)
    this.projects.push(project)
    return project
  } catch (error) {
    console.error('Failed to create project:', error)
    this.error = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    this.loading = false
  }
},
```

- [ ] **Step 3: 确认 updateProject 不需要改动**

`updateProject` 接收完整 `Project` 对象，签名无需改动。调用方传入的对象自然不再包含已移除的字段。

---

### Task 4: 改造转录 composable 为纯函数

**Files:**
- Modify: `composables/useWhisper.ts`
- Modify: `composables/useTranscribeService.ts`

- [ ] **Step 1: 改造 useWhisper.ts**

将整个文件替换为：

```typescript
// composables/useWhisper.ts
export interface WhisperSegment {
  start: number
  end: number
  text: string
}

export interface WhisperResult {
  segments: WhisperSegment[]
}

export async function transcribeWithWhisper(audioPath: string, apiUrl: string): Promise<WhisperResult> {
  if (!apiUrl) {
    throw new Error('Whisper API 地址未配置')
  }

  const response = await fetch('/api/whisper/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      audioPath,
      whisperApiUrl: apiUrl,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText)
  }

  return response.json()
}
```

- [ ] **Step 2: 改造 useTranscribeService.ts**

将整个文件替换为：

```typescript
// composables/useTranscribeService.ts
export interface TranscribeSegment {
  start: number
  end: number
  text: string
}

interface TranscribeServiceBody {
  from: number
  to: number
  content: string
}

interface TranscribeServiceResult {
  status: 'success' | 'error'
  message?: string
  body: TranscribeServiceBody[]
}

export async function transcribeWithService(
  audioPath: string,
  apiUrl: string,
  apiToken?: string
): Promise<TranscribeSegment[]> {
  if (!apiUrl) {
    throw new Error('转录服务 API 地址未配置')
  }

  const response = await fetch('/api/transcribe-service/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      audioPath,
      transcribeApiUrl: apiUrl,
      transcribeApiToken: apiToken,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText)
  }

  const result: TranscribeServiceResult = await response.json()

  if (result.status === 'error') {
    throw new Error(result.message || '转录服务返回错误')
  }

  return result.body
    .map(item => ({
      start: item.from,
      end: item.to,
      text: item.content.trim(),
    }))
    .filter(seg => seg.text.length > 0)
}
```

- [ ] **Step 3: 删除 utils/whisper.ts**

`utils/whisper.ts` 中有 `transcribeAudio` 函数和 `WhisperResult` 类型，现在 `useWhisper.ts` 已自包含，`utils/whisper.ts` 不再被引用（标注页会移除引用，项目页不引用它）。删除该文件。

```bash
rm utils/whisper.ts
```

- [ ] **Step 4: 删除 utils/transcribeService.ts**

同理，`utils/transcribeService.ts` 中的功能已并入 `composables/useTranscribeService.ts`。删除该文件。

```bash
rm utils/transcribeService.ts
```

---

### Task 5: 首页 — 设置入口 + 移除项目编辑中的转录配置

**Files:**
- Modify: `pages/index.vue`

- [ ] **Step 1: 在 script setup 中增加 useSettings 引用和设置 Modal 状态**

在 `<script setup lang="ts">` 中已有变量声明区域后增加：

```typescript
// 全局设置
const { settings: globalSettings, loadSettings, saveSettings } = useSettings()
const showSettingsModal = ref(false)
const settingsForm = ref({
  transcribeType: 'none' as 'whisper' | 'transcribeService' | 'none',
  whisperApiUrl: '',
  transcribeApiUrl: '',
  transcribeApiToken: '',
})
```

**注意：** 不要创建新的 `onMounted`。将 `await loadSettings()` 合并到已有的 `onMounted` 中：

```typescript
onMounted(async () => {
  await projectStore.initialize()
  await loadSettings()
})
```

- [ ] **Step 2: 在模板中增加设置按钮和 Modal**

在 `<n-space>` 按钮区域中，在"导出管理"按钮之前增加：

```html
<n-button @click="handleOpenSettings">
  设置
</n-button>
```

在最后一个 `</n-modal>` 之后、`</div>` 结束标签之前增加设置 Modal：

```html
<n-modal v-model:show="showSettingsModal" preset="dialog" title="全局设置">
  <n-form>
    <n-form-item label="转录服务">
      <n-radio-group v-model:value="settingsForm.transcribeType">
        <n-space>
          <n-radio value="whisper">Whisper API</n-radio>
          <n-radio value="transcribeService">转录服务 (transcribe-service)</n-radio>
          <n-radio value="none">不配置</n-radio>
        </n-space>
      </n-radio-group>
    </n-form-item>
    <template v-if="settingsForm.transcribeType === 'whisper'">
      <n-form-item label="Whisper API 地址">
        <n-input v-model:value="settingsForm.whisperApiUrl" placeholder="请输入 Whisper API 地址" />
      </n-form-item>
    </template>
    <template v-if="settingsForm.transcribeType === 'transcribeService'">
      <n-form-item label="转录服务 API 地址">
        <n-input v-model:value="settingsForm.transcribeApiUrl" placeholder="如 http://localhost:31080/transcribe" />
      </n-form-item>
      <n-form-item label="转录服务 Token">
        <n-input v-model:value="settingsForm.transcribeApiToken" type="password" show-password-on="click" placeholder="可选，留空则不认证" />
      </n-form-item>
    </template>
  </n-form>
  <template #action>
    <n-space>
      <n-button @click="showSettingsModal = false">取消</n-button>
      <n-button type="primary" @click="handleSaveSettings">保存</n-button>
    </n-space>
  </template>
</n-modal>
```

- [ ] **Step 3: 从创建/编辑项目 Modal 中移除转录配置**

移除 `<n-form-item label="转录服务">` 整个区块（包含 `n-radio-group`），以及紧随其后的两个 `<template v-if="formModel.transcribeType === ...">` 区块。

将 `formModel` 的定义改为：

```typescript
const formModel = ref({
  id: '',
  name: '',
  description: '',
})
```

将 `handleCancel` 中的 formModel 重置改为：

```typescript
formModel.value = {
  id: '',
  name: '',
  description: '',
}
```

将 `handleEditProject` 中加载表单改为：

```typescript
formModel.value = {
  id: project.id,
  name: project.name,
  description: project.description || '',
}
```

将 `handleSubmit` 中的项目创建/更新改为：

```typescript
if (isEditing.value) {
  const existing = projectStore.projects.find(p => p.id === formModel.value.id)
  await projectStore.updateProject({
    id: formModel.value.id,
    name: formModel.value.name,
    description: formModel.value.description,
    createdAt: existing?.createdAt || new Date(),
    updatedAt: new Date(),
  })
  message.success('项目已更新')
} else {
  await projectStore.createProject(
    formModel.value.name,
    formModel.value.description
  )
  message.success('项目已创建')
}
```

移除 `rules` 中不再需要的校验规则（如果有的话）。

---

### Task 6: 项目页 — 增加识别按钮

**Files:**
- Modify: `pages/project/[id].vue`

- [ ] **Step 1: 在 script 中增加识别相关代码**

在 `<script setup lang="ts">` 中增加以下 import 和逻辑：

在已有 import 后面增加：

```typescript
import { transcribeWithWhisper, type WhisperSegment } from '~/composables/useWhisper'
import { transcribeWithService, type TranscribeSegment } from '~/composables/useTranscribeService'
```

增加状态和逻辑变量：

```typescript
const { settings: globalSettings, loadSettings, isTranscribeConfigured } = useSettings()
const transcribingFileId = ref<string | null>(null)
const showTranscribeConfirmModal = ref(false)
const fileToTranscribe = ref<AudioFile | null>(null)

const handleTranscribe = (file: AudioFile) => {
  fileToTranscribe.value = file
  showTranscribeConfirmModal.value = true
}

const handleConfirmTranscribe = async () => {
  const file = fileToTranscribe.value
  if (!file || !currentProject.value) return
  showTranscribeConfirmModal.value = false
  transcribingFileId.value = file.id

  try {
    await projectStore.setCurrentAudioFile(file)

    const segments = globalSettings.value.transcribeType === 'whisper'
      ? (await transcribeWithWhisper(file.wavPath, globalSettings.value.whisperApiUrl)).segments
      : await transcribeWithService(file.wavPath, globalSettings.value.transcribeApiUrl, globalSettings.value.transcribeApiToken)

    const annotations = segments.map(seg => ({
      id: crypto.randomUUID(),
      audioFileId: file.id,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      whisperText: seg.text,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    await projectStore.updateAnnotations(annotations)
    message.success(`识别完成，共 ${annotations.length} 个片段`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '识别失败')
  } finally {
    transcribingFileId.value = null
    fileToTranscribe.value = null
  }
}
```

在 `onMounted` 中增加 `await loadSettings()`，并 `await setCurrentProject` 确保数据加载完成后再允许操作：

```typescript
onMounted(async () => {
  await projectStore.initialize()
  await loadSettings()
  const project = projectStore.projects.find(p => p.id === route.params.id)
  if (!project) {
    message.error('项目不存在')
    router.push('/')
    return
  }
  await projectStore.setCurrentProject(project)
})
```

- [ ] **Step 2: 在模板中增加识别按钮和 Modal**

在每个音频文件的操作按钮区域（"标注"按钮之后）增加识别按钮。在现有：

```html
<n-button
  type="primary"
  @click="handleSwitchToDOM(file)"
  :disabled="file.status !== 'ready'"
  title="使用DOM渲染优化的标注界面"
>
  标注
</n-button>
```

后面增加：

```html
<n-button
  type="warning"
  @click="handleTranscribe(file)"
  :disabled="file.status !== 'ready' || getAnnotationCount(file.id) > 0 || !isTranscribeConfigured || !!transcribingFileId"
  :loading="transcribingFileId === file.id"
>
  识别
</n-button>
```

在页面末尾 `</n-modal>` 之后增加确认对话框：

```html
<n-modal
  v-model:show="showTranscribeConfirmModal"
  preset="dialog"
  title="确认识别文本"
  type="warning"
>
  <div>确定要识别 "{{ fileToTranscribe?.originalName }}" 的文本吗？</div>
  <div style="margin-top: 8px; color: #999; font-size: 13px;">
    <ul style="padding-left: 20px; margin: 4px 0;">
      <li>识别过程可能需要较长时间，请耐心等待</li>
      <li>识别结果可能不够准确，建议识别后进行人工校正</li>
    </ul>
  </div>
  <template #action>
    <n-space>
      <n-button @click="showTranscribeConfirmModal = false">取消</n-button>
      <n-button type="warning" @click="handleConfirmTranscribe">开始识别</n-button>
    </n-space>
  </template>
</n-modal>
```

- [ ] **Step 3: 增加 NButtonGroup 组件 import（如需要）**

检查现有 import 中是否已有 `NButton`（应该有），无需额外 import。

---

### Task 7: 标注页 — 移除识别相关代码

**Files:**
- Modify: `pages/project-dom-annotation/[projectId]/[audioId]/index.vue`

- [ ] **Step 1: 移除模板中的识别按钮**

删除顶部 `<n-page-header>` 的 `<template #extra>` 中的识别按钮：

```html
<n-button type="primary" ghost @click="handleTranscribe" :loading="transcribing"
  :disabled="!currentProject?.whisperApiUrl && !currentProject?.transcribeApiUrl">
  识别文本
</n-button>
```

- [ ] **Step 2: 移除识别结果对话框和确认对话框模板**

删除 `<!-- 添加识别结果对话框 -->` 对应的整个 `<n-modal v-model:show="showTranscribeResultModal"` 区块。

删除 `<!-- 添加识别确认对话框 -->` 对应的整个 `<n-modal v-model:show="showTranscribeConfirmModal"` 区块。

- [ ] **Step 3: 移除 script 中的识别相关引用和状态**

删除以下行：

```typescript
const { transcribe } = useWhisper()
const { transcribe: transcribeWithService } = useTranscribeService()

const transcribeServiceName = computed(() =>
  currentProject.value?.whisperApiUrl ? 'Whisper API' : '转录服务'
)
```

删除 `transcribing` ref 声明。

删除 `handleConfirmTranscribe` 函数。

删除 `showTranscribeResultModal` ref 和 `transcribeResult` ref。

删除 `showTranscribeConfirmModal` ref。

删除 `handleTranscribe` 函数。

- [ ] **Step 4: 确认无残留引用**

用 grep 确认标注页文件中不再有任何 `useWhisper`、`useTranscribeService`、`transcribing`、`transcribe`、`showTranscribeConfirmModal`、`showTranscribeResultModal` 的引用。如果还有残留，删除。

---

### Task 8: 构建验证

- [ ] **Step 1: 运行构建**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 构建成功，无 TypeScript 错误。

- [ ] **Step 2: 检查是否有遗漏的引用**

```bash
grep -r "useWhisper\|useTranscribeService\|whisperApiUrl\|transcribeApiUrl\|transcribeApiToken" src pages components --include="*.ts" --include="*.vue" --exclude-dir=node_modules
```

Expected: 只剩下 `composables/useWhisper.ts`、`composables/useTranscribeService.ts`、`composables/useSettings.ts`、`pages/project/[id].vue` 中的引用，不应在 `pages/index.vue` 的 formModel 或 `pages/project-dom-annotation/` 中出现。

- [ ] **Step 3: 运行 dev server 手动验证**

```bash
pnpm dev
```

验证：
1. 首页有"设置"按钮，点击弹出设置 Modal，可配置转录服务
2. 创建/编辑项目 Modal 中无转录配置
3. 项目页音频列表有"识别"按钮，0 标注的可用，有标注的 disabled
4. 点击识别按钮可正常调用转录服务并保存结果
5. 标注页无"识别文本"按钮
