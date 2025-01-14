# 状态管理模块

状态管理模块使用 Pinia 实现，负责管理应用的全局状态，包括项目、音频文件和标注数据。本模块与本地存储模块紧密集成，确保数据的持久化。

## 状态结构

### 项目状态

```typescript
interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  audioFiles: AudioFile[]
  currentAudioFile: AudioFile | null
  annotations: Annotation[]
}
```

## Store 定义

```typescript
export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    projects: [],
    currentProject: null,
    audioFiles: [],
    currentAudioFile: null,
    annotations: []
  }),

  getters: {
    projectAudioFiles: (state) => {
      const currentProject = state.currentProject
      if (!currentProject) return []
      return state.audioFiles.filter(f => f.projectId === currentProject.id)
    },

    audioFileAnnotations: (state) => {
      const currentAudioFile = state.currentAudioFile
      if (!currentAudioFile) return []
      return state.annotations.filter(a => a.audioFileId === currentAudioFile.id)
    }
  },

  actions: {
    // 初始化
    async initialize() {
      const [projects, audioFiles, annotations] = await Promise.all([
        storage.loadProjects(),
        storage.loadAudioFiles(),
        storage.loadAnnotations()
      ])
      
      this.projects = projects
      this.audioFiles = audioFiles
      this.annotations = annotations
    },

    // 项目管理
    async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
      const newProject: Project = {
        id: generateId(),
        ...project,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      this.projects.push(newProject)
      await storage.saveProjects(this.projects)
      return newProject
    },

    // 音频文件管理
    async addAudioFile(file: File, projectId: string) {
      const audioFile: AudioFile = {
        id: generateId(),
        projectId,
        originalName: file.name,
        originalPath: await saveFile(file),
        wavPath: '',
        duration: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      this.audioFiles.push(audioFile)
      await storage.saveAudioFiles(this.audioFiles)
      return audioFile
    },

    // 标注管理
    async updateAnnotation(annotation: Partial<Annotation> & { id: string }) {
      const index = this.annotations.findIndex(a => a.id === annotation.id)
      if (index === -1) {
        const newAnnotation: Annotation = {
          ...annotation,
          createdAt: new Date(),
          updatedAt: new Date()
        } as Annotation
        this.annotations.push(newAnnotation)
      } else {
        this.annotations[index] = {
          ...this.annotations[index],
          ...annotation,
          updatedAt: new Date()
        }
      }
      
      await storage.saveAnnotations(this.annotations)
    }
  }
})
```

## 使用示例

1. **初始化 Store**
```typescript
const store = useProjectStore()
await store.initialize()
```

2. **创建新项目**
```typescript
const project = await store.createProject({
  name: '新项目',
  description: '项目描述'
})
```

3. **上传音频文件**
```typescript
const audioFile = await store.addAudioFile(file, project.id)
```

4. **更新标注**
```typescript
await store.updateAnnotation({
  id: 'a1',
  text: '新的标注文本',
  start: 10,
  end: 20
})
```

## 状态订阅

### 监听状态变化

```typescript
watch(
  () => store.currentProject,
  (newProject) => {
    if (newProject) {
      // 加载项目相关数据
    }
  }
)
```

### 订阅 Store 变化

```typescript
store.$subscribe((mutation, state) => {
  console.log('Store 变化:', mutation.type, mutation.payload)
})
```

## 组件集成

### 在组件中使用 Store

```vue
<script setup lang="ts">
import { useProjectStore } from '~/stores/project'

const store = useProjectStore()
const projects = computed(() => store.projects)
const currentProject = computed(() => store.currentProject)

async function createProject() {
  await store.createProject({
    name: '新项目',
    description: '项目描述'
  })
}
</script>

<template>
  <div>
    <h1>项目列表</h1>
    <ul>
      <li v-for="project in projects" :key="project.id">
        {{ project.name }}
      </li>
    </ul>
  </div>
</template>
```

## 性能优化

1. **计算属性缓存**
   - 使用 computed 而不是方法
   - 避免不必要的重计算
   - 合理设置依赖项

2. **批量更新**
   - 使用 batch 函数包装多个更新
   - 避免频繁触发订阅
   - 合理使用防抖和节流

3. **状态分割**
   - 按功能模块拆分 store
   - 避免大型单一 store
   - 使用模块化管理

## 调试工具

1. **Vue Devtools**
   - 实时查看状态
   - 追踪状态变化
   - 时间旅行调试

2. **日志记录**
```typescript
store.$subscribe((mutation, state) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Store 变化:', {
      type: mutation.type,
      payload: mutation.payload,
      state
    })
  }
})
```

## 最佳实践

1. **状态设计**
   - 保持状态扁平化
   - 避免冗余数据
   - 合理使用规范化

2. **类型安全**
   - 使用 TypeScript
   - 定义完整的类型
   - 避免 any 类型

3. **错误处理**
   - 捕获异常
   - 提供错误状态
   - 实现回滚机制

## 相关文档

- [Pinia 官方文档](https://pinia.vuejs.org/)
- [Vue 组合式 API](https://v3.vuejs.org/guide/composition-api-introduction.html)
- [数据存储](./storage.md)
- [组件文档](../components/README.md) 