# 标注组件

标注组件是 Visual Split Mark 的核心功能组件，负责音频片段的标注和管理。本文档详细介绍各个标注相关组件的实现和使用方法。

## Editor 组件

标注编辑器组件是标注功能的主要界面，集成了波形显示、时间轴和文本编辑功能。

### Props

```typescript
interface EditorProps {
  audioFile: AudioFile          // 音频文件信息
  annotations: Annotation[]     // 标注数据
  currentTime: number          // 当前播放时间
  playing: boolean             // 是否正在播放
  whisperEnabled?: boolean     // 是否启用 Whisper
}
```

### Events

```typescript
interface EditorEmits {
  'update:currentTime': [time: number]                    // 更新当前时间
  'update:playing': [playing: boolean]                    // 更新播放状态
  'annotation-add': [annotation: Partial<Annotation>]     // 添加标注
  'annotation-update': [annotation: Annotation]           // 更新标注
  'annotation-delete': [annotationId: string]            // 删除标注
  'whisper-recognize': [start: number, end: number]      // Whisper 识别请求
}
```

### 使用示例

```vue
<template>
  <Editor
    :audio-file="audioFile"
    :annotations="annotations"
    v-model:current-time="currentTime"
    v-model:playing="isPlaying"
    :whisper-enabled="true"
    @annotation-add="onAnnotationAdd"
    @annotation-update="onAnnotationUpdate"
    @annotation-delete="onAnnotationDelete"
    @whisper-recognize="onWhisperRecognize"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Editor } from '~/components/annotation'
import type { AudioFile, Annotation } from '~/types'

const audioFile = ref<AudioFile>()
const annotations = ref<Annotation[]>([])
const currentTime = ref(0)
const isPlaying = ref(false)

async function onAnnotationAdd(annotation: Partial<Annotation>) {
  // 处理添加标注
}

async function onAnnotationUpdate(annotation: Annotation) {
  // 处理更新标注
}

async function onAnnotationDelete(annotationId: string) {
  // 处理删除标注
}

async function onWhisperRecognize(start: number, end: number) {
  // 处理 Whisper 识别请求
}
</script>
```

## Timeline 组件

时间轴组件用于显示和管理音频片段的时间范围，支持拖拽调整和时间标记。

### Props

```typescript
interface TimelineProps {
  duration: number           // 音频总时长
  currentTime: number       // 当前时间
  segments: Segment[]       // 时间片段
  scale?: number           // 时间刻度（像素/秒）
  height?: number          // 时间轴高度
}

interface Segment {
  id: string
  start: number
  end: number
  color?: string
  label?: string
}
```

### Events

```typescript
interface TimelineEmits {
  'segment-add': [start: number, end: number]           // 添加片段
  'segment-update': [id: string, start: number, end: number]  // 更新片段
  'segment-delete': [id: string]                        // 删除片段
  'time-change': [time: number]                         // 时间变化
}
```

### 使用示例

```vue
<template>
  <Timeline
    :duration="duration"
    :current-time="currentTime"
    :segments="timelineSegments"
    :scale="pixelsPerSecond"
    :height="80"
    @segment-add="onSegmentAdd"
    @segment-update="onSegmentUpdate"
    @segment-delete="onSegmentDelete"
    @time-change="onTimeChange"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Timeline } from '~/components/annotation'
import type { Segment } from '~/types'

const duration = ref(0)
const currentTime = ref(0)
const pixelsPerSecond = ref(50)

const timelineSegments = computed(() => {
  // 转换标注数据为时间轴片段
  return annotations.value.map(annotation => ({
    id: annotation.id,
    start: annotation.start,
    end: annotation.end,
    label: annotation.text
  }))
})

// 事件处理函数...
</script>
```

## SegmentList 组件

片段列表组件用于显示和管理所有标注片段，支持文本编辑和播放控制。

### Props

```typescript
interface SegmentListProps {
  segments: Annotation[]     // 标注片段列表
  currentTime: number       // 当前播放时间
  playing: boolean         // 是否正在播放
  editingId?: string      // 正在编辑的片段 ID
}
```

### Events

```typescript
interface SegmentListEmits {
  'edit': [segment: Annotation]                // 编辑片段
  'delete': [segmentId: string]               // 删除片段
  'play': [start: number, end: number]        // 播放片段
  'text-change': [id: string, text: string]   // 文本变化
}
```

### 使用示例

```vue
<template>
  <SegmentList
    :segments="annotations"
    :current-time="currentTime"
    :playing="isPlaying"
    :editing-id="editingSegmentId"
    @edit="onEdit"
    @delete="onDelete"
    @play="onPlay"
    @text-change="onTextChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { SegmentList } from '~/components/annotation'
import type { Annotation } from '~/types'

const annotations = ref<Annotation[]>([])
const currentTime = ref(0)
const isPlaying = ref(false)
const editingSegmentId = ref<string>()

function onEdit(segment: Annotation) {
  editingSegmentId.value = segment.id
}

function onDelete(segmentId: string) {
  // 处理删除
}

function onPlay(start: number, end: number) {
  // 控制播放
}

function onTextChange(id: string, text: string) {
  // 更新文本
}
</script>
```

## 组件组合

这些组件通常一起使用，形成完整的标注界面：

```vue
<template>
  <div class="annotation-workspace">
    <div class="main-editor">
      <Editor
        v-bind="editorProps"
        v-on="editorEvents"
      />
    </div>

    <div class="timeline-container">
      <Timeline
        v-bind="timelineProps"
        v-on="timelineEvents"
      />
    </div>

    <div class="segment-list">
      <SegmentList
        v-bind="segmentListProps"
        v-on="segmentListEvents"
      />
    </div>

    <div class="toolbar">
      <n-button-group>
        <n-button @click="onAddSegment">
          添加片段
        </n-button>
        <n-button @click="onWhisperRecognize">
          Whisper 识别
        </n-button>
        <n-button @click="onExport">
          导出
        </n-button>
      </n-button-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAnnotationStore } from '~/stores/annotation'
import { Editor, Timeline, SegmentList } from '~/components/annotation'
import type { AudioFile, Annotation } from '~/types'

const store = useAnnotationStore()
// 组件状态和事件处理...
</script>

<style scoped>
.annotation-workspace {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 1rem;
  height: 100%;
  padding: 1rem;
}

.main-editor {
  grid-row: 1;
}

.timeline-container {
  grid-row: 2;
}

.segment-list {
  grid-row: 3;
  overflow-y: auto;
}

.toolbar {
  grid-row: 4;
  display: flex;
  justify-content: flex-end;
}
</style>
```

## 最佳实践

1. **性能优化**
   - 使用虚拟滚动显示大量片段
   - 避免频繁更新波形
   - 优化拖拽操作性能

2. **用户体验**
   - 提供键盘快捷键
   - 实现撤销/重做功能
   - 自动保存标注数据

3. **错误处理**
   - 验证时间范围
   - 处理音频加载失败
   - 防止数据丢失

## 常见问题

1. **时间同步**
```typescript
// 使用 requestAnimationFrame 更新时间
let rafId: number
function updateTime() {
  if (audioElement.paused) return
  currentTime.value = audioElement.currentTime
  rafId = requestAnimationFrame(updateTime)
}

watch(isPlaying, (playing) => {
  if (playing) {
    updateTime()
  } else {
    cancelAnimationFrame(rafId)
  }
})
```

2. **拖拽处理**
```typescript
function onSegmentDrag(event: DragEvent, segment: Segment) {
  const delta = event.movementX / pixelsPerSecond.value
  const newStart = Math.max(0, segment.start + delta)
  const newEnd = Math.min(duration.value, segment.end + delta)
  
  if (newEnd - newStart >= 0.1) {  // 最小片段长度 0.1 秒
    updateSegment(segment.id, newStart, newEnd)
  }
}
```

3. **文本编辑**
```typescript
function onTextChange(id: string, text: string) {
  const segment = annotations.value.find(a => a.id === id)
  if (segment) {
    segment.text = text
    segment.updatedAt = new Date()
    saveAnnotations()
  }
}
```

## 测试指南

1. **单元测试**
```typescript
describe('Timeline', () => {
  it('should convert time to pixels correctly', () => {
    // 测试代码...
  })

  it('should handle segment overlap', () => {
    // 测试代码...
  })
})
```

2. **组件测试**
```typescript
import { mount } from '@vue/test-utils'

describe('Editor', () => {
  it('should emit annotation-add event with correct data', async () => {
    // 测试代码...
  })

  it('should update annotation text', async () => {
    // 测试代码...
  })
})
```

## 相关文档

- [Wavesurfer.js](https://wavesurfer-js.org/)
- [音频处理](../core/audio.md)
- [Whisper API](../core/whisper.md)
- [状态管理](../core/state.md) 