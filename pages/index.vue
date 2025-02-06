<template>
  <div class="page-container">
    <n-space vertical size="large">
      <n-space justify="space-between">
        <n-h1>项目列表</n-h1>
        <n-button type="primary" @click="showCreateModal = true">
          创建项目
        </n-button>
      </n-space>

      <n-card>
        <n-empty v-if="!projects.length" description="暂无项目">
          <template #extra>
            <n-button type="primary" @click="showCreateModal = true">
              创建项目
            </n-button>
          </template>
        </n-empty>

        <n-list v-else>
          <n-list-item v-for="project in projects" :key="project.id">
            <n-thing>
              <template #header>
                <n-space justify="space-between">
                  <n-text>{{ project.name }}</n-text>
                  <n-space>
                    <n-button
                      text
                      type="primary"
                      @click="handleEditProject(project)"
                    >
                      编辑
                    </n-button>
                    <n-button
                      text
                      type="error"
                      @click="handleDeleteProject(project)"
                    >
                      删除
                    </n-button>
                    <n-button
                      type="primary"
                      @click="navigateToProject(project)"
                    >
                      打开
                    </n-button>
                  </n-space>
                </n-space>
              </template>
              <template #description>
                <n-text depth="3">
                  创建时间: {{ formatDate(project.createdAt) }}
                </n-text>
              </template>
              {{ project.description || '暂无描述' }}
            </n-thing>
          </n-list-item>
        </n-list>
      </n-card>
    </n-space>

    <n-modal
      v-model:show="showCreateModal"
      preset="dialog"
      :title="isEditing ? '编辑项目' : '创建项目'"
    >
      <n-form ref="formRef" :model="formModel" :rules="rules">
        <n-form-item label="项目名称" path="name">
          <n-input
            v-model:value="formModel.name"
            placeholder="请输入项目名称"
          />
        </n-form-item>
        <n-form-item label="项目描述" path="description">
          <n-input
            v-model:value="formModel.description"
            type="textarea"
            placeholder="请输入项目描述"
          />
        </n-form-item>
        <n-form-item label="Whisper API 地址" path="whisperApiUrl">
          <n-input
            v-model:value="formModel.whisperApiUrl"
            placeholder="请输入 Whisper API 地址"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="handleCancel">取消</n-button>
          <n-button type="primary" @click="handleSubmit">确定</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showDeleteModal"
      preset="dialog"
      title="删除项目"
      negative-text="取消"
      positive-text="确定"
      @positive-click="handleConfirmDelete"
    >
      <n-text
        >确定要删除项目 "{{ projectToDelete?.name }}"
        吗？此操作不可恢复。</n-text
      >
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { useMessage } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import type { Project } from '~/types/project'
import { useHead } from 'unhead'

useHead({
  title: '项目列表 - Visual Split Mark',
})

const projectStore = useProjectStore()
const message = useMessage()

const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const isEditing = ref(false)
const projectToDelete = ref<Project | null>(null)

const formRef = ref<FormInst | null>(null)
const formModel = ref({
  id: '',
  name: '',
  description: '',
  whisperApiUrl: '',
})

const rules: FormRules = {
  name: {
    required: true,
    message: '请输入项目名称',
    trigger: 'blur',
  },
}

const projects = computed(() => projectStore.projects)

onMounted(async () => {
  await projectStore.initialize()
})

const formatDate = (date: Date) => {
  return format(date, 'yyyy-MM-dd HH:mm:ss')
}

const handleEditProject = (project: Project) => {
  isEditing.value = true
  formModel.value = {
    id: project.id,
    name: project.name,
    description: project.description || '',
    whisperApiUrl: project.whisperApiUrl || '',
  }
  showCreateModal.value = true
}

const handleDeleteProject = (project: Project) => {
  projectToDelete.value = project
  showDeleteModal.value = true
}

const handleConfirmDelete = async () => {
  if (!projectToDelete.value) return
  await projectStore.deleteProject(projectToDelete.value.id)
  message.success('项目已删除')
  showDeleteModal.value = false
  projectToDelete.value = null
}

const navigateToProject = (project: Project) => {
  projectStore.setCurrentProject(project)
  navigateTo(`/project/${project.id}`)
}

const handleCancel = () => {
  showCreateModal.value = false
  isEditing.value = false
  formModel.value = {
    id: '',
    name: '',
    description: '',
    whisperApiUrl: '',
  }
}

const handleSubmit = () => {
  formRef.value?.validate(async errors => {
    if (!errors) {
      try {
        if (isEditing.value) {
          await projectStore.updateProject({
            id: formModel.value.id,
            name: formModel.value.name,
            description: formModel.value.description,
            whisperApiUrl: formModel.value.whisperApiUrl,
            createdAt: new Date(), // 这个值会被 store 忽略
            updatedAt: new Date(),
          })
          message.success('项目已更新')
        } else {
          await projectStore.createProject(
            formModel.value.name,
            formModel.value.description,
            formModel.value.whisperApiUrl
          )
          message.success('项目已创建')
        }
        handleCancel()
      } catch (error) {
        message.error('操作失败')
      }
    }
  })
}
</script>
