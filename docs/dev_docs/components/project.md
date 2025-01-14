# 项目组件

项目组件负责项目的管理功能，包括项目的创建、编辑、删除和展示。本文档详细介绍各个项目相关组件的实现和使用方法。

## ProjectList 组件

项目列表组件用于展示所有项目，支持项目的筛选和排序。

### Props

```typescript
interface ProjectListProps {
  projects: Project[]           // 项目列表
  loading?: boolean            // 加载状态
  sortBy?: 'name' | 'date'    // 排序方式
  sortOrder?: 'asc' | 'desc'  // 排序顺序
  filter?: string             // 筛选关键词
}
```

### Events

```typescript
interface ProjectListEmits {
  'edit': [project: Project]           // 编辑项目
  'delete': [project: Project]         // 删除项目
  'select': [project: Project]         // 选择项目
  'sort-change': [sortOptions: Sort]   // 排序变化
}
```

### 使用示例

```vue
<template>
  <ProjectList
    :projects="projects"
    :loading="loading"
    :sort-by="sortBy"
    :sort-order="sortOrder"
    :filter="searchKeyword"
    @edit="onEditProject"
    @delete="onDeleteProject"
    @select="onSelectProject"
    @sort-change="onSortChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ProjectList } from '~/components/project'
import type { Project, Sort } from '~/types'

const projects = ref<Project[]>([])
const loading = ref(false)
const sortBy = ref<'name' | 'date'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')
const searchKeyword = ref('')

function onEditProject(project: Project) {
  // 处理项目编辑
}

function onDeleteProject(project: Project) {
  // 处理项目删除
}

function onSelectProject(project: Project) {
  // 处理项目选择
}

function onSortChange(sort: Sort) {
  sortBy.value = sort.by
  sortOrder.value = sort.order
}
</script>
```

## ProjectCard 组件

项目卡片组件用于展示单个项目的信息，包括项目名称、描述、创建时间等。

### Props

```typescript
interface ProjectCardProps {
  project: Project            // 项目信息
  selected?: boolean         // 是否选中
  showActions?: boolean      // 是否显示操作按钮
}
```

### Events

```typescript
interface ProjectCardEmits {
  'edit': []                 // 编辑按钮点击
  'delete': []               // 删除按钮点击
  'click': []                // 卡片点击
}
```

### 使用示例

```vue
<template>
  <ProjectCard
    :project="project"
    :selected="isSelected"
    :show-actions="true"
    @edit="onEdit"
    @delete="onDelete"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ProjectCard } from '~/components/project'
import type { Project } from '~/types'

const project = ref<Project>({
  id: '1',
  name: '示例项目',
  description: '这是一个示例项目',
  createdAt: new Date(),
  updatedAt: new Date()
})
const isSelected = ref(false)

function onEdit() {
  // 处理编辑
}

function onDelete() {
  // 处理删除
}

function onClick() {
  // 处理点击
}
</script>
```

## ProjectForm 组件

项目表单组件用于创建和编辑项目，包含项目信息的输入表单。

### Props

```typescript
interface ProjectFormProps {
  project?: Project          // 编辑时的项目信息
  loading?: boolean         // 提交状态
}
```

### Events

```typescript
interface ProjectFormEmits {
  'submit': [project: Partial<Project>]   // 表单提交
  'cancel': []                            // 取消操作
}
```

### 使用示例

```vue
<template>
  <ProjectForm
    :project="editingProject"
    :loading="submitting"
    @submit="onSubmit"
    @cancel="onCancel"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ProjectForm } from '~/components/project'
import type { Project } from '~/types'

const editingProject = ref<Project>()
const submitting = ref(false)

async function onSubmit(project: Partial<Project>) {
  submitting.value = true
  try {
    // 保存项目
    await saveProject(project)
  } finally {
    submitting.value = false
  }
}

function onCancel() {
  // 处理取消
}
</script>
```

## 组件组合

这些组件通常一起使用，形成完整的项目管理界面：

```vue
<template>
  <div class="project-manager">
    <div class="header">
      <h1>项目管理</h1>
      <n-button @click="showCreateForm = true">
        创建项目
      </n-button>
    </div>

    <div class="search-bar">
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索项目..."
      />
      <n-select
        v-model:value="sortBy"
        :options="sortOptions"
      />
    </div>

    <ProjectList
      :projects="filteredProjects"
      :loading="loading"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :filter="searchKeyword"
      @edit="onEditProject"
      @delete="onDeleteProject"
      @select="onSelectProject"
      @sort-change="onSortChange"
    />

    <n-modal v-model:show="showCreateForm">
      <ProjectForm
        :loading="submitting"
        @submit="onSubmitProject"
        @cancel="showCreateForm = false"
      />
    </n-modal>

    <n-modal v-model:show="!!editingProject">
      <ProjectForm
        v-if="editingProject"
        :project="editingProject"
        :loading="submitting"
        @submit="onSubmitProject"
        @cancel="editingProject = null"
      />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore } from '~/stores/project'
import { ProjectList, ProjectForm } from '~/components/project'
import type { Project, Sort } from '~/types'

const store = useProjectStore()
const loading = ref(false)
const submitting = ref(false)
const showCreateForm = ref(false)
const editingProject = ref<Project | null>(null)
const searchKeyword = ref('')
const sortBy = ref<'name' | 'date'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')

const filteredProjects = computed(() => {
  // 实现项目过滤和排序逻辑
})

// 事件处理函数...
</script>

<style scoped>
.project-manager {
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.search-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
</style>
```

## 最佳实践

1. **状态管理**
   - 使用 Pinia store 管理项目数据
   - 实现数据的本地持久化
   - 保持状态的一致性

2. **表单验证**
   - 使用 vee-validate 进行表单验证
   - 提供实时验证反馈
   - 防止重复提交

3. **用户体验**
   - 添加加载状态提示
   - 实现操作确认对话框
   - 提供操作成功/失败提示

## 常见问题

1. **数据加载**
```typescript
async function loadProjects() {
  loading.value = true
  try {
    await store.initialize()
  } catch (error) {
    message.error('加载项目失败')
  } finally {
    loading.value = false
  }
}
```

2. **表单验证**
```typescript
const rules = {
  name: [
    { required: true, message: '请输入项目名称' },
    { min: 2, max: 50, message: '项目名称长度应在 2-50 个字符之间' }
  ],
  description: [
    { max: 200, message: '描述不能超过 200 个字符' }
  ]
}
```

3. **删除确认**
```typescript
async function onDeleteProject(project: Project) {
  try {
    await dialog.warning({
      title: '确认删除',
      content: '删除项目后无法恢复，是否继续？',
      positiveText: '确认',
      negativeText: '取消'
    })
    await store.deleteProject(project.id)
    message.success('删除成功')
  } catch {
    // 用户取消或删除失败
  }
}
```

## 测试指南

1. **单元测试**
```typescript
describe('ProjectList', () => {
  it('should filter projects by keyword', () => {
    // 测试代码...
  })

  it('should sort projects correctly', () => {
    // 测试代码...
  })
})
```

2. **组件测试**
```typescript
import { mount } from '@vue/test-utils'

describe('ProjectForm', () => {
  it('should validate required fields', async () => {
    // 测试代码...
  })

  it('should emit submit event with form data', async () => {
    // 测试代码...
  })
})
```

## 相关文档

- [Naive UI](https://www.naiveui.com/)
- [Pinia 状态管理](../core/state.md)
- [数据存储](../core/storage.md)
- [测试指南](../testing/README.md) 