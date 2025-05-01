<template>
  <div class="page-container">
    <n-space vertical size="large">
      <n-space justify="space-between">
        <n-h1>导出管理</n-h1>
        <n-button type="primary" @click="navigateToHome">
          返回首页
        </n-button>
      </n-space>

      <n-card>
        <n-empty v-if="!exportItems.length" description="暂无导出数据">
          <template #extra>
            <n-text>请先在项目中导出数据</n-text>
          </template>
        </n-empty>

        <div v-else>
          <n-data-table
            :columns="columns"
            :data="exportItems"
            :pagination="pagination"
            :row-key="(row: ExportItem) => row.path"
            @update:checked-row-keys="handleCheckedRowKeysChange"
          />

          <n-space justify="end" style="margin-top: 16px">
            <n-button 
              type="primary" 
              :disabled="checkedRowKeys.length === 0"
              @click="handleProcessExports"
            >
              处理选中导出
            </n-button>
          </n-space>
        </div>
      </n-card>
    </n-space>

    <!-- 处理导出的模态框 -->
    <n-modal
      v-model:show="showProcessModal"
      preset="dialog"
      title="处理导出数据"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmProcessExports"
    >
      <n-space vertical>
        <n-text>将选中的导出项分割为训练集和测试集：</n-text>
        <n-text>- 训练集占比：90%</n-text>
        <n-text>- 测试集占比：10%</n-text>
        <n-text>- 输出目录：storage/datasets/{{ outputDirName }}</n-text>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { useHead } from 'unhead'
import { useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'

useHead({
  title: '导出管理 - Visual Split Mark',
})

const message = useMessage()
const router = useRouter()

// 导出项列表
interface ExportItem {
  path: string
  dirname: string
  projectName: string
  exportTime: string
  segments: number
  duration: number
  selected: boolean
  config: any
}

const exportItems = ref<ExportItem[]>([])
const checkedRowKeys = ref<string[]>([])

// 分页配置
const pagination = ref<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 40],
  onChange: (page: number) => {
    pagination.value.page = page
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.value.pageSize = pageSize
    pagination.value.page = 1
  },
})

// 表格列定义
const columns: DataTableColumns<ExportItem> = [
  {
    type: 'selection',
  },
  {
    title: '导出名称',
    key: 'dirname',
    sorter: 'default',
  },
  {
    title: '项目名称',
    key: 'projectName',
  },
  {
    title: '导出时间',
    key: 'exportTime',
    sorter: 'default',
  },
  {
    title: '片段数',
    key: 'segments',
    sorter: 'default',
  },
  {
    title: '总时长',
    key: 'duration',
    render(row: ExportItem) {
      return formatDuration(row.duration)
    },
    sorter: 'default',
  },
]

// 处理选中行变化
const handleCheckedRowKeysChange = (keys: string[]) => {
  checkedRowKeys.value = keys
}

// 选中的导出项
const selectedExports = computed(() => {
  return exportItems.value.filter((item: ExportItem) => 
    checkedRowKeys.value.includes(item.path)
  )
})

// 处理导出的模态框
const showProcessModal = ref(false)

// 输出目录名称
const outputDirName = ref(format(new Date(), 'yyyyMMdd-HHmmss'))

// 加载导出列表
const loadExports = async () => {
  try {
    const response = await $fetch<{ exports: ExportItem[] }>('/api/export-manager/list')
    exportItems.value = response.exports
  } catch (error) {
    console.error('加载导出列表失败:', error)
    message.error('加载导出列表失败')
  }
}

// 处理选中的导出项
const handleProcessExports = () => {
  if (checkedRowKeys.value.length === 0) {
    message.warning('请先选择要处理的导出项')
    return
  }
  
  // 更新输出目录名称
  outputDirName.value = format(new Date(), 'yyyyMMdd-HHmmss')
  showProcessModal.value = true
}

// 确认处理导出
const confirmProcessExports = async () => {
  try {
    const response = await $fetch<{
      success: boolean
      outputPath?: string
      error?: string
      stats?: {
        total: number
        train: number
        test: number
      }
    }>('/api/export-manager/process', {
      method: 'POST',
      body: {
        exports: selectedExports.value.map((item: ExportItem) => item.path),
        outputDir: `storage/datasets/${outputDirName.value}`
      }
    })
    
    if (response.success) {
      message.success(`处理成功，数据已保存到 ${response.outputPath || ''}`)
    } else {
      message.error('处理失败: ' + (response.error || '未知错误'))
    }
  } catch (error) {
    console.error('处理导出失败:', error)
    message.error('处理导出失败')
  } finally {
    showProcessModal.value = false
  }
}

// 格式化时长
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// 返回首页
const navigateToHome = () => {
  router.push('/')
}

// 页面加载时获取导出列表
onMounted(async () => {
  await loadExports()
})
</script>

<style scoped>
.page-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
