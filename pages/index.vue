<template>
  <div class="page-container">
    <n-space vertical size="large">
      <n-space justify="space-between">
        <n-h1>项目列表</n-h1>
        <n-space>
          <n-button @click="handleOpenSettings">
            设置
          </n-button>
          <n-button type="primary" @click="navigateToExportManager">
            导出管理
          </n-button>
          <n-button type="primary" @click="showCreateModal = true">
            创建项目
          </n-button>
        </n-space>
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

// 全局设置
const { settings: globalSettings, loadSettings, saveSettings } = useSettings()
const showSettingsModal = ref(false)
const settingsForm = ref({
  transcribeType: 'none' as 'whisper' | 'transcribeService' | 'none',
  whisperApiUrl: '',
  transcribeApiUrl: '',
  transcribeApiToken: '',
})

const handleOpenSettings = () => {
  settingsForm.value = {
    transcribeType: globalSettings.value.transcribeType,
    whisperApiUrl: globalSettings.value.whisperApiUrl,
    transcribeApiUrl: globalSettings.value.transcribeApiUrl,
    transcribeApiToken: globalSettings.value.transcribeApiToken,
  }
  showSettingsModal.value = true
}

const handleSaveSettings = async () => {
  try {
    await saveSettings(settingsForm.value)
    message.success('设置已保存')
    showSettingsModal.value = false
  } catch {
    message.error('保存设置失败')
  }
}

const formRef = ref<FormInst | null>(null)
const formModel = ref({
  id: '',
  name: '',
  description: '',
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
  await loadSettings()
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
  }
}

const handleSubmit = () => {
  formRef.value?.validate(async errors => {
    if (!errors) {
      try {
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
        handleCancel()
      } catch (error) {
        message.error('操作失败')
      }
    }
  })
}

const navigateToExportManager = () => {
  navigateTo('/export-manager')
}
</script>
