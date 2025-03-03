<template>
  <div class="page-container">
    <n-space vertical size="large">
      <n-page-header @back="handleBack">
        <template #title>
          <n-space align="center">
            <span>音频标注 - {{ currentAudioFile?.originalName }}</span>
            <n-text
              class="note-text"
              :depth="3"
              style="font-size: 13px; cursor: pointer"
              @click="handleEditNote"
            >
              {{ currentAudioFile?.note || '无备注' }}
            </n-text>
          </n-space>
        </template>
        <template #extra>
          <n-space>
            <n-button
              type="error"
              ghost
              @click="handleClearAll"
              :disabled="!annotations.length"
            >
              清除所有标注
            </n-button>
            <n-button
              type="primary"
              ghost
              @click="handleTranscribe"
              :loading="transcribing"
              :disabled="!currentProject?.whisperApiUrl"
            >
              识别文本
            </n-button>
            <n-button
              type="primary"
              ghost
              @click="showExportModal = true"
              :disabled="!annotations.length"
            >
              导出数据集
            </n-button>
          </n-space>
        </template>
      </n-page-header>

      <div class="main-content">
        <div class="toolbar">
          <n-space align="center">
            <n-button circle @click="handlePlayPause">
              <template #icon>
                <client-only>
                  <n-icon v-if="showIcons" :size="16">
                    <icon-play v-if="!isPlaying" />
                    <icon-pause v-else />
                  </n-icon>
                </client-only>
              </template>
            </n-button>
            <n-text style="line-height: 34px"
              >{{ formatDuration(currentTime) }} /
              {{ formatDuration(duration) }}</n-text
            >
            <n-divider vertical style="height: 24px; margin: 5px 0" />
            <n-button-group>
              <n-button @click="handleDecreaseRate" style="height: 34px">
                <template #icon>
                  <n-icon><icon-remove /></n-icon>
                </template>
              </n-button>
              <n-text style="padding: 0 8px; line-height: 34px"
                >{{ playbackRate }}倍播放</n-text
              >
              <n-button @click="handleIncreaseRate" style="height: 34px">
                <template #icon>
                  <n-icon><icon-add /></n-icon>
                </template>
              </n-button>
            </n-button-group>
            <n-divider vertical style="height: 24px; margin: 5px 0" />
            <n-text v-if="selectedRegion" style="line-height: 34px">
              选中区间：{{ formatDuration(selectedRegion.start) }} -
              {{ formatDuration(selectedRegion.end) }}
            </n-text>
            <n-divider
              v-if="selectedRegion"
              vertical
              style="height: 24px; margin: 5px 0"
            />
            <n-button-group>
              <n-button @click="handleZoomOut" style="height: 34px">
                <template #icon>
                  <n-icon><icon-zoom-out /></n-icon>
                </template>
              </n-button>
              <n-button @click="handleZoomIn" style="height: 34px">
                <template #icon>
                  <n-icon><icon-zoom-in /></n-icon>
                </template>
              </n-button>
            </n-button-group>
            <n-text style="line-height: 34px"
              >{{ Math.round(pixelsPerSecond) }}px/s</n-text
            >
            <n-divider vertical style="height: 24px; margin: 5px 0" />
            <n-space align="center">
              <n-text>渲染范围:</n-text>
              <n-input-number
                v-model:value="viewportStartPercent"
                :min="0"
                :max="maxStartPercent"
                :step="1"
                size="small"
                style="width: 80px"
              />
              <n-text>% ({{ formatDuration(viewport.startTime) }})</n-text>
              <n-text>-</n-text>
              <n-input-number
                v-model:value="viewportEndPercent"
                :min="minEndPercent"
                :max="100"
                :step="1"
                size="small"
                style="width: 80px"
              />
              <n-text>% ({{ formatDuration(viewport.endTime) }})</n-text>
            </n-space>
          </n-space>
        </div>

        <div class="content-container">
          <div class="waveform-container">
            <div ref="waveformRef" class="waveform"></div>
          </div>
        </div>
      </div>
    </n-space>

    <!-- 加载状态模态框 -->
    <n-modal
      v-model:show="isLoading"
      :mask-closable="false"
      :closable="false"
      preset="card"
      style="width: 400px"
      class="loading-modal"
      :title="loadingDescription"
    >
      <n-space vertical justify="center" align="center">
        <n-spin size="large" />
      </n-space>
    </n-modal>

    <!-- 添加删除确认对话框 -->
    <n-modal
      v-model:show="showDeleteModal"
      preset="dialog"
      title="删除标注"
      type="warning"
    >
      <div>确定要删除这条标注吗？</div>
      <template #action>
        <n-space>
          <n-button @click="showDeleteModal = false">取消</n-button>
          <n-button type="error" @click="handleConfirmDelete"
            >确定删除</n-button
          >
        </n-space>
      </template>
    </n-modal>

    <!-- 添加标注文本输入对话框 -->
    <n-modal
      v-model:show="showTextInputModal"
      preset="dialog"
      :title="pendingAnnotation?.text ? '编辑标注' : '输入标注文本'"
    >
      <n-input
        v-model:value="annotationText"
        type="textarea"
        placeholder="请输入标注文本"
        :autosize="{ minRows: 3, maxRows: 5 }"
      />
      <template #action>
        <n-space>
          <n-button @click="showTextInputModal = false">取消</n-button>
          <n-button type="primary" @click="handleConfirmAnnotation"
            >确定</n-button
          >
        </n-space>
      </template>
    </n-modal>

    <!-- 导出配置对话框 -->
    <n-modal
      v-model:show="showExportModal"
      preset="card"
      title="导出数据集"
      style="width: 500px"
      :closable="true"
      :mask-closable="false"
    >
      <n-space vertical>
        <!-- 导出选项 -->
        <n-card title="导出选项" :bordered="false">
          <n-space vertical>
            <n-switch v-model:value="exportConfig.mergeSentences">
              <template #checked>合并模式：开启</template>
              <template #unchecked>合并模式：关闭</template>
            </n-switch>
            <n-text depth="3" style="margin-left: 24px">
              自动合并相邻的标注
            </n-text>

            <template v-if="exportConfig.mergeSentences">
              <n-divider />

              <n-form-item label="时长限制">
                <n-space vertical>
                  <n-space align="center">
                    <n-input-number
                      v-model:value="exportConfig.maxDuration"
                      :min="1"
                      :max="120"
                      size="small"
                      style="width: 100px"
                    />
                    <n-text>秒</n-text>
                  </n-space>
                  <n-text depth="3" style="margin-left: 24px">
                    合并后的音频片段不会超过此时长。在严格模式下，只有间隔小于最大间隔的标注才会合并；在宽松模式下，只要合并后不超过此时长即可合并。
                  </n-text>
                </n-space>
              </n-form-item>

              <n-form-item label="合并方式">
                <n-space vertical>
                  <n-radio-group
                    v-model:value="exportConfig.mergeOnlyConsecutive"
                  >
                    <n-space vertical>
                      <n-radio :value="false">
                        宽松：合并任意相邻标注（不限间隔）
                      </n-radio>
                      <n-radio :value="true">
                        严格：仅合并间隔小于指定时长的标注
                      </n-radio>
                    </n-space>
                  </n-radio-group>

                  <div
                    style="margin-left: 32px"
                    v-if="exportConfig.mergeOnlyConsecutive"
                  >
                    <n-form-item label="最大间隔">
                      <n-space align="center">
                        <n-input-number
                          v-model:value="exportConfig.maxGap"
                          :min="0.1"
                          :max="5"
                          :step="0.1"
                          size="small"
                          style="width: 100px"
                        />
                        <n-text>秒</n-text>
                      </n-space>
                    </n-form-item>
                  </div>

                  <div
                    style="margin-left: 32px"
                    v-if="!exportConfig.mergeOnlyConsecutive"
                  >
                    <n-form-item label="间隔处理">
                      <n-switch v-model:value="exportConfig.keepGaps">
                        <template #checked>保留间隔</template>
                        <template #unchecked>移除间隔</template>
                      </n-switch>
                      <n-text depth="3" style="margin-left: 8px">
                        {{
                          exportConfig.keepGaps
                            ? '保留标注之间的空白片段'
                            : '移除标注之间的空白片段'
                        }}
                      </n-text>
                    </n-form-item>
                  </div>
                </n-space>
              </n-form-item>
            </template>

            <n-divider />

            <n-switch v-model:value="exportConfig.includeTimestamps">
              <template #checked>时间戳训练：开启</template>
              <template #unchecked>时间戳训练：关闭</template>
            </n-switch>
            <n-text depth="3" style="margin-left: 24px">
              仅在需要训练模型输出时间戳时开启。开启后导出的 JSON 中会添加
              sentences 字段，用于训练模型预测每句话的起止时间。
            </n-text>
          </n-space>
        </n-card>

        <n-space justify="end">
          <n-button @click="handleCloseExport">取消</n-button>
          <n-button type="primary" @click="handleStartExport"
            >开始导出</n-button
          >
        </n-space>
      </n-space>
    </n-modal>

    <!-- 导出进度对话框 -->
    <n-modal
      v-model:show="showExportProgress"
      preset="card"
      title="导出进度"
      style="width: 600px"
      :closable="false"
      :mask-closable="false"
    >
      <n-space vertical>
        <!-- 导出配置摘要 -->
        <n-card title="导出配置" :bordered="false" size="small">
          <n-descriptions :column="1" size="small">
            <n-descriptions-item label="合并模式">
              {{ exportConfig.mergeSentences ? '开启' : '关闭' }}
            </n-descriptions-item>
            <n-descriptions-item label="时间戳训练">
              {{ exportConfig.includeTimestamps ? '开启' : '关闭' }}
            </n-descriptions-item>
            <template v-if="exportConfig.mergeSentences">
              <n-descriptions-item label="时长限制">
                {{ exportConfig.maxDuration }} 秒
              </n-descriptions-item>
              <n-descriptions-item label="合并方式">
                {{
                  exportConfig.mergeOnlyConsecutive
                    ? `严格（间隔 < ${exportConfig.maxGap}秒）`
                    : exportConfig.keepGaps
                    ? '宽松（保留间隔）'
                    : '宽松（移除间隔）'
                }}
              </n-descriptions-item>
            </template>
          </n-descriptions>
        </n-card>

        <n-divider />

        <!-- 进度显示 -->
        <template v-if="status === 'exporting'">
          <n-progress
            type="line"
            :percentage="progress"
            :show-indicator="true"
            :processing="true"
            indicator-placement="inside"
          >
            正在导出 {{ progress }}%
          </n-progress>
        </template>

        <template v-else-if="status === 'completed'">
          <n-result
            status="success"
            title="导出成功"
            description="数据集已导出到以下目录："
          >
            <template #footer>
              <n-space vertical>
                <n-text code>{{ exportPath }}</n-text>
                <n-space justify="center">
                  <n-button @click="showInFileManager(exportPath)">
                    在文件管理器中显示
                  </n-button>
                </n-space>
              </n-space>
            </template>
          </n-result>
        </template>

        <template v-else-if="status === 'failed'">
          <n-result
            status="error"
            title="导出失败"
            :description="exportError"
          />
        </template>
      </n-space>

      <template #footer>
        <n-space justify="end">
          <n-button
            @click="handleCloseExportProgress"
            :disabled="status === 'exporting'"
          >
            {{
              status === 'completed'
                ? '完成'
                : status === 'failed'
                ? '关闭'
                : '取消'
            }}
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 添加识别结果对话框 -->
    <n-modal
      v-model:show="showTranscribeResultModal"
      preset="card"
      title="识别结果"
      style="width: 500px"
      :closable="true"
      :mask-closable="false"
    >
      <n-space vertical>
        <n-result
          :status="transcribeResult.success ? 'success' : 'error'"
          :title="transcribeResult.success ? '识别成功' : '识别失败'"
          :description="
            transcribeResult.success
              ? `文本识别完成，共识别出 ${transcribeResult.count} 个片段。\n\n视图更新可能需要一些时间，如果没有看到最新结果，可以手动刷新页面。\n\n请检查识别结果，如有需要可以手动修改。`
              : transcribeResult.message
          "
        />
        <n-space justify="end">
          <n-button @click="() => router.go(0)">刷新页面</n-button>
          <n-button type="primary" @click="showTranscribeResultModal = false">
            {{ transcribeResult.success ? '开始编辑' : '关闭' }}
          </n-button>
        </n-space>
      </n-space>
    </n-modal>

    <!-- 添加识别确认对话框 -->
    <n-modal
      v-model:show="showTranscribeConfirmModal"
      preset="dialog"
      title="确认识别文本"
      type="warning"
      :show-icon="true"
    >
      <n-space vertical>
        <div>此操作将使用 Whisper API 识别音频中的文本。</div>
        <template v-if="annotations.length > 0">
          <n-alert type="warning" :show-icon="true">
            <template #header>
              <span style="font-weight: 500"
                >当前音频已有 {{ annotations.length }} 条标注</span
              >
            </template>
            新的识别结果将追加到现有标注之后，请谨慎操作。
          </n-alert>
        </template>
        <div>注意：</div>
        <ul style="margin: 0; padding-left: 20px">
          <li>识别过程可能需要较长时间，请耐心等待</li>
          <li>识别结果可能不够准确，建议在识别后进行人工校正</li>
          <li>如果已有标注，新的识别结果会追加到现有标注之后</li>
        </ul>
      </n-space>

      <template #action>
        <n-space>
          <n-button @click="showTranscribeConfirmModal = false">取消</n-button>
          <n-button type="warning" @click="handleConfirmTranscribe"
            >开始识别</n-button
          >
        </n-space>
      </template>
    </n-modal>

    <!-- 添加清除所有标注确认对话框 -->
    <n-modal
      v-model:show="showClearAllModal"
      preset="dialog"
      title="清除所有标注"
      type="error"
      :show-icon="true"
    >
      <template #default>
        <n-space vertical>
          <div>确定要清除当前音频的所有标注吗？</div>
          <n-alert type="error" :show-icon="true">
            <template #header>
              <span style="font-weight: 500"
                >此操作将删除 {{ annotations.length }} 条标注</span
              >
            </template>
            此操作不可恢复，请谨慎操作。
          </n-alert>
        </n-space>
      </template>
      <template #action>
        <n-space>
          <n-button @click="showClearAllModal = false">取消</n-button>
          <n-button type="error" @click="handleConfirmClearAll"
            >确定清除</n-button
          >
        </n-space>
      </template>
    </n-modal>

    <!-- 添加备注编辑对话框 -->
    <n-modal
      v-model:show="showNoteModal"
      preset="dialog"
      title="编辑备注"
      positive-text="确定"
      negative-text="取消"
      @positive-click="handleSaveNote"
      @negative-click="() => (showNoteModal = false)"
    >
      <n-input
        v-model:value="noteText"
        type="textarea"
        placeholder="请输入备注"
        :autosize="{ minRows: 3, maxRows: 5 }"
      />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  watch,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
  unref,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format } from 'date-fns'
import { useMessage } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import type { ComponentPublicInstance } from 'vue'
import type { Annotation, AudioFile } from '~/types/project'
import type { WhisperResult } from '~/utils/whisper'
import type { MergeDirection } from '~/types/audio'
import { storage } from '~/utils/storage'
import { useAudioVisualizer } from '~/composables/useAudioVisualizer'
import { useAudioPlayer, type LoadingPhase } from '~/composables/useAudioPlayer'
import { useWhisper } from '~/composables/useWhisper'
import {
  AddCircleOutline as IconZoomIn,
  RemoveCircleOutline as IconZoomOut,
  AddOutline as IconAdd,
  RemoveOutline as IconRemove,
} from '@vicons/ionicons5'
import { WarningOutlined } from '@vicons/antd'
import { useViewportStore } from '~/stores/viewport'
import type { MessageReactive } from 'naive-ui'
import { NSpin } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useExport } from '~/composables/useExport'
import { useViewState } from '~/composables/useViewState'
import { useDebounceFn } from '@vueuse/core'
import type { AudioViewState } from '~/composables/useViewState'
import { useHead } from 'unhead'

// 格式化音频时长（秒数）
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// 格式化时间戳
const formatTimestamp = (time: Date) => {
  return format(time, 'yyyy-MM-dd HH:mm:ss')
}

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const message = useMessage()
const viewport = useViewportStore()
const { transcribe } = useWhisper()

// 添加缺失的响应式变量
const transcribing = ref(false)
const exporting = ref(false)
const currentProject = computed(() => projectStore.currentProject)

const {
  isPlaying,
  duration,
  currentTime,
  pixelsPerSecond,
  selectedRegion,
  editingAnnotation,
  clearEditingAnnotation,
  initialize,
  destroy,
  playPause,
  seek,
  zoomIn,
  zoomOut,
  addRegion,
  updateRegion,
  removeRegion,
  clearRegions,
  playbackRate,
  setPlaybackRate,
  onAddButtonClick,
  onEditButtonClick,
  onDeleteButtonClick,
  onMergeLeftButtonClick,
  onMergeRightButtonClick,
  handleMerge,
  updateDrawing,
  loadingPhase,
  loadingProgress,
  centerViewOnTime,
  viewportStartPercent,
  viewportEndPercent,
  maxStartPercent,
  minEndPercent,
} = useAudioVisualizer()

const waveformRef = ref<HTMLElement | null>(null)
const showDeleteModal = ref(false)
const annotationToDelete = ref<Annotation | null>(null)
const saving = ref(false)
const isInitialized = ref(false)

const currentAudioFile = computed(() => projectStore.currentAudioFile)
const annotations = computed(() => projectStore.audioFileAnnotations)

// 添加新的响应式变量
const showTextInputModal = ref(false)
const annotationText = ref('')
const pendingAnnotation = ref<Annotation | null>(null)

// 添加表单相关变量
const formRef = ref<FormInst | null>(null)
const showEditModal = ref(false)
const formModel = ref({
  id: '',
  start: 0,
  end: 0,
  text: '',
})

// 添加表单验证规则
const rules: FormRules = {
  text: [{ required: true, message: '请输入标注文本', trigger: 'blur' }],
  start: [
    {
      required: true,
      type: 'number',
      message: '请输入开始时间',
      trigger: 'blur',
    },
  ],
  end: [
    {
      required: true,
      type: 'number',
      message: '请输入结束时间',
      trigger: 'blur',
    },
  ],
}

const showIcons = ref(false)

const audioPlayer = useAudioPlayer()

// 修改加载描述计算属性
const loadingDescription = computed(() => {
  const phaseText: Record<LoadingPhase, string> = {
    idle: '准备加载',
    downloading: '下载中',
    decoding: '解码中',
    ready: '加载完成',
  }

  const phase = loadingPhase.value
  const progress = loadingProgress.value
  const text = phaseText[phase] || '加载中'

  if (phase === 'ready') return ''

  if (phase === 'downloading' && progress === 0) {
    return text
  }

  return `${text} ${progress.toFixed(1)}%`
})

// 修改加载状态计算属性
const isLoading = computed({
  get: () => loadingPhase.value !== 'ready',
  set: () => {}, // 模态框不需要双向绑定
})

// 修改倍速控制函数
const handleIncreaseRate = () => {
  const newRate = Math.min(5, playbackRate.value + 0.5)
  setPlaybackRate(newRate)
}

const handleDecreaseRate = () => {
  const newRate = Math.max(0.5, playbackRate.value - 0.5)
  setPlaybackRate(newRate)
}

// 设置按钮回调函数
const setupButtonCallbacks = () => {
  // 设置按钮点击回调
  onAddButtonClick.value = handleAddAnnotation
  onEditButtonClick.value = (id: string) => {
    const annotation = annotations.value.find(a => a.id === id)
    if (annotation) {
      handleEditAnnotation(annotation)
    }
  }
  onDeleteButtonClick.value = (id: string) => {
    const annotation = annotations.value.find(a => a.id === id)
    if (annotation) {
      annotationToDelete.value = annotation
      showDeleteModal.value = true
    }
  }

  // 添加合并按钮回调
  onMergeLeftButtonClick.value = (id: string) => {
    if (!currentAudioFile.value) {
      message.error('音频文件不存在')
      return
    }
    handleMerge(
      id,
      'left',
      currentAudioFile.value.projectId,
      currentAudioFile.value.id
    )
  }
  onMergeRightButtonClick.value = (id: string) => {
    if (!currentAudioFile.value) {
      message.error('音频文件不存在')
      return
    }
    handleMerge(
      id,
      'right',
      currentAudioFile.value.projectId,
      currentAudioFile.value.id
    )
  }
}

// 添加标注处理函数
const handleAddAnnotation = () => {
  if (selectedRegion.value) {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      audioFileId: currentAudioFile.value?.id || '',
      start: selectedRegion.value.start,
      end: selectedRegion.value.end,
      text: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // 显示文本输入框
    pendingAnnotation.value = annotation
    annotationText.value = ''
    showTextInputModal.value = true
  }
}

// 监听文本输入框的显示状态
watch(showTextInputModal, newValue => {
  if (!newValue && pendingAnnotation.value) {
    // 如果关闭了文本输入框，且没有输入文本，则删除标注
    if (!annotationText.value) {
      projectStore.deleteAnnotation(pendingAnnotation.value.id)
    }
    pendingAnnotation.value = null
    annotationText.value = ''
  }
})

// 添加视图状态管理
const viewState = useViewState(route.params.audioId as string)

// 添加防抖保存
const debouncedUpdateState = useDebounceFn((state: Partial<AudioViewState>) => {
  if (!isInitialized.value) {
    return
  }

  // 确保所有必需的字段都存在
  const fullState: AudioViewState = {
    currentTime: state.currentTime ?? currentTime.value,
    scrollPosition: state.scrollPosition ?? 0,
    startTime: state.startTime ?? unref(viewport.startTime),
    endTime: state.endTime ?? unref(viewport.endTime),
    pixelsPerSecond: state.pixelsPerSecond ?? pixelsPerSecond.value,
  }

  viewState.updateState(fullState)
}, 500) // 500ms 的防抖时间

// 监听视口状态变化
watch(
  [
    currentTime,
    toRef(viewport, 'startTime'),
    toRef(viewport, 'endTime'),
    pixelsPerSecond,
    viewportStartPercent,
    viewportEndPercent,
  ],
  newValues => {
    const [
      newCurrentTime,
      newStartTime,
      newEndTime,
      newPixelsPerSecond,
      newStartPercent,
      newEndPercent,
    ] = newValues

    if (!isInitialized.value || !waveformRef.value) return

    // 获取滚动容器
    const container = document.querySelector('.waveform-container')
    if (!container) return

    // 更新视图状态
    debouncedUpdateState({
      currentTime: newCurrentTime,
      scrollPosition: container.scrollLeft,
      startTime: newStartTime,
      endTime: newEndTime,
      pixelsPerSecond: newPixelsPerSecond,
    })
  },
  {
    immediate: false, // 改为 false，等初始化完成后再开始监听
  }
)

// 在初始化完成后恢复状态
const restoreViewState = async () => {
  if (!viewState.viewState.value) return

  const state = viewState.viewState.value

  // 先设置视口范围和缩放比例
  viewport.setViewport(state.startTime, state.endTime)
  pixelsPerSecond.value = state.pixelsPerSecond

  // 等待下一个渲染周期
  await nextTick()

  // 恢复播放时间
  seek(state.currentTime)

  // 等待波形图重绘完成
  await updateDrawing()

  // 最后恢复滚动位置
  const container = document.querySelector('.waveform-container')
  if (container) {
    container.scrollLeft = state.scrollPosition
  }

  // 居中到当前播放位置
  await centerViewOnTime(state.currentTime)
}

onMounted(async () => {
  const projectId = route.params.projectId as string
  const audioId = route.params.audioId as string

  if (!projectId || !audioId) {
    message.error('参数错误')
    router.push('/')
    return
  }

  try {
    await projectStore.initialize()
    await projectStore.loadProject(projectId)

    const project = projectStore.projects.find(p => p.id === projectId)
    if (!project) {
      message.error('项目不存在')
      router.push('/')
      return
    }

    // 设置当前项目
    projectStore.setCurrentProject(project)

    // 查找音频文件
    const audioFile = projectStore.audioFiles.find(f => f.id === audioId)
    if (!audioFile) {
      message.error('音频文件不存在')
      router.push(`/project/${projectId}`)
      return
    }

    // 设置当前音频文件
    projectStore.setCurrentAudioFile(audioFile)

    // 初始化波形图
    if (!isInitialized.value && waveformRef.value) {
      try {
        // 先设置按钮回调
        setupButtonCallbacks()

        await initialize(
          waveformRef.value,
          audioFile,
          undefined,
          async annotation => {
            // 如果是删除操作
            if ('deleted' in annotation) {
              await projectStore.deleteAnnotation(annotation.id)
              return
            }

            // 更新标注
            const existingAnnotation = annotations.value.find(
              (a: Annotation) => a.id === annotation.id
            )
            await projectStore.updateAnnotation({
              ...annotation,
              audioFileId: audioFile.id,
              text: annotation.text || '',
              whisperText: existingAnnotation?.whisperText || '',
              createdAt: existingAnnotation?.createdAt || new Date(),
              updatedAt: new Date(),
            })
            message.success('标注已更新')
          }
        )
        isInitialized.value = true

        // 加载已有标注
        annotations.value.forEach(annotation => {
          addRegion(annotation)
        })

        // 恢复视口状态
        await restoreViewState()
      } catch (error) {
        message.error('音频加载失败')
      }
    }

    // 添加一个小延迟确保 DOM 完全加载
    setTimeout(() => {
      showIcons.value = true
    }, 0)

    // 添加键盘事件监听
    window.addEventListener('keydown', handleKeydown)

    // 手动触发一次 resize 事件以更新布局
    window.dispatchEvent(new Event('resize'))
  } catch (error) {
    console.error('Failed to initialize:', error)
    message.error('初始化失败')
    router.push('/')
  }
})

onUnmounted(() => {
  destroy()
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)

  // 保存最终状态
  if (waveformRef.value) {
    const container = waveformRef.value.parentElement?.parentElement
    if (container && container.classList.contains('waveform-container')) {
      viewState.updateState({
        currentTime: currentTime.value,
        scrollPosition: container.scrollLeft,
        startTime: unref(viewport.startTime),
        endTime: unref(viewport.endTime),
        pixelsPerSecond: pixelsPerSecond.value,
      })
    }
  }
})

// 添加键盘事件处理函数
const handleKeydown = (event: KeyboardEvent) => {
  // 如果当前焦点在输入框中，不处理空格键
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }

  // 处理空格键
  if (event.code === 'Space') {
    event.preventDefault() // 阻止页面滚动
    handlePlayPause()
  }
}

const handleBack = () => {
  const projectId = route.params.projectId
  router.push(`/project/${projectId}`)
}

const handlePlayPause = async () => {
  if (!isInitialized.value) return
  playPause()
}

const handleEditAnnotation = (annotation: Annotation) => {
  pendingAnnotation.value = annotation
  annotationText.value = annotation.text || ''
  showTextInputModal.value = true
  seek(annotation.start)
}

const handleDeleteClick = (annotation: Annotation | null) => {
  if (!annotation) return
  annotationToDelete.value = annotation
  showDeleteModal.value = true
}

const handleConfirmDelete = async () => {
  if (!annotationToDelete.value) return
  try {
    removeRegion(annotationToDelete.value.id)
    await projectStore.deleteAnnotation(annotationToDelete.value.id)
    showDeleteModal.value = false
    message.success('标注已删除')
  } catch (error) {
    message.error('删除失败')
  }
}

const handleCancel = () => {
  showTextInputModal.value = false
  annotationText.value = ''
  pendingAnnotation.value = null
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    const annotation: Annotation = {
      id: formModel.value.id,
      audioFileId: currentAudioFile.value?.id || '',
      start: Number(formModel.value.start),
      end: Number(formModel.value.end),
      text: formModel.value.text,
      whisperText: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await projectStore.updateAnnotation(annotation)
    updateRegion(annotation)
    showEditModal.value = false
    message.success('标注已更新')
  } catch (error) {
    console.error('Validation failed:', error)
  }
}

// 添加识别结果对话框的状态
const showTranscribeResultModal = ref(false)
const transcribeResult = ref<{
  success: boolean
  message: string
  count?: number
}>({
  success: false,
  message: '',
})

// 添加识别确认对话框的状态
const showTranscribeConfirmModal = ref(false)

// 修改识别处理函数
const handleTranscribe = () => {
  if (!currentProject.value?.whisperApiUrl) {
    message.error('未配置 Whisper API URL')
    return
  }
  showTranscribeConfirmModal.value = true
}

// 添加确认识别的处理函数
const handleConfirmTranscribe = async () => {
  if (!currentAudioFile.value) return
  showTranscribeConfirmModal.value = false
  transcribing.value = true
  try {
    const annotations = await transcribe(currentAudioFile.value)
    transcribeResult.value = {
      success: true,
      message: '文本识别完成',
      count: annotations.length,
    }
  } catch (error) {
    transcribeResult.value = {
      success: false,
      message: error instanceof Error ? error.message : '文本识别失败',
    }
  } finally {
    transcribing.value = false
    showTranscribeResultModal.value = true
  }
}

// 导出相关的状态
const showExportModal = ref(false)
const showExportProgress = ref(false)
const { exportAnnotations, progress, status, exportConfig, resetStatus } =
  useExport()
const exportPath = ref('')
const exportError = ref('')

// 修改导出相关的代码
const handleStartExport = async () => {
  if (!currentProject.value || !currentAudioFile.value) {
    message.error('当前项目或音频文件不存在')
    showExportModal.value = false
    return
  }

  try {
    showExportModal.value = false
    showExportProgress.value = true
    const result = await exportAnnotations(
      currentProject.value.name,
      currentAudioFile.value
    )
    if (result) {
      exportPath.value = result.path
    }
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : '导出失败'
    message.error('导出失败：' + exportError.value)
  }
}

// 处理关闭配置对话框
const handleCloseExport = () => {
  showExportModal.value = false
}

// 处理关闭进度对话框
const handleCloseExportProgress = () => {
  if (status.value === 'exporting') return
  showExportProgress.value = false
  if (status.value === 'completed' || status.value === 'failed') {
    exportPath.value = ''
    exportError.value = ''
    resetStatus()
  }
}

// 修改确认标注的处理函数
const handleConfirmAnnotation = async () => {
  if (!pendingAnnotation.value) return

  const annotation: Annotation = {
    ...pendingAnnotation.value,
    text: annotationText.value || '',
    whisperText: pendingAnnotation.value.whisperText || '',
    createdAt: pendingAnnotation.value.createdAt || new Date(),
    updatedAt: new Date(),
  }

  const isNewAnnotation = !annotations.value.find(a => a.id === annotation.id)

  // 更新标注
  await projectStore.updateAnnotation(annotation)

  if (isNewAnnotation) {
    // 如果是新建标注
    addRegion(annotation)
    message.success('标注已添加')
  } else {
    // 如果是编辑标注
    updateRegion(annotation)
    message.success('标注已更新')
  }

  showTextInputModal.value = false
  annotationText.value = ''
  pendingAnnotation.value = null
}

const handleZoomIn = () => {
  zoomIn()
}

const handleZoomOut = () => {
  zoomOut()
}

// 监听标注列表的变化
watch(
  () => projectStore.audioFileAnnotations,
  newAnnotations => {
    // 清除所有标注区域
    clearRegions()
    // 重新添加所有标注
    newAnnotations.forEach(annotation => {
      addRegion(annotation)
    })
  },
  { deep: true }
)

// 在文件管理器中显示
const showInFileManager = async (path: string) => {
  try {
    await $fetch('/api/file/show', {
      method: 'POST',
      body: { path },
    })
  } catch (error) {
    message.error('无法打开文件夹')
  }
}

// 添加清除所有标注确认对话框的状态
const showClearAllModal = ref(false)

// 添加清除所有标注的处理函数
const handleClearAll = () => {
  showClearAllModal.value = true
}

// 添加确认清除所有标注的处理函数
const handleConfirmClearAll = async () => {
  showClearAllModal.value = false
  try {
    // 清除所有标注
    clearRegions()
    await projectStore.clearAllAnnotations()
    message.success('所有标注已清除')
  } catch (error) {
    message.error('清除标注失败')
  }
}

// 添加备注相关的状态
const showNoteModal = ref(false)
const noteText = ref('')

// 添加编辑备注的处理函数
const handleEditNote = () => {
  noteText.value = currentAudioFile.value?.note || ''
  showNoteModal.value = true
}

const handleSaveNote = async () => {
  if (!currentAudioFile.value) return

  try {
    await projectStore.updateAudioFile({
      ...currentAudioFile.value,
      note: noteText.value,
      updatedAt: new Date(),
    })
    showNoteModal.value = false
    message.success('备注已更新')
  } catch (error) {
    message.error('更新备注失败')
  }
}

useHead({
  title: computed(
    () =>
      `标注 - ${
        currentAudioFile.value?.originalName || '音频文件'
      } - Visual Split Mark`
  ).value,
})
</script>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 200px);
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 16px;
}

.toolbar {
  padding: 8px;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.toolbar :deep(.n-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar :deep(.n-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.content-container {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  min-height: 0;
}

.waveform-container {
  background-color: #fff;
  border-radius: 4px;
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
}

.waveform {
  position: relative;
  width: 100%;
  height: 100%;
}

.annotations-container,
.annotations-list,
.annotation-item,
.annotation-header,
.annotation-time,
.annotation-actions,
.annotation-text {
  display: none;
}

.page-container {
  position: relative;
}

.loading-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

:deep(.n-card-header) {
  text-align: center;
  font-size: 16px;
  padding: 12px 0;
}

:deep(.n-card__content) {
  padding: 24px;
}

:deep(.n-spin) {
  margin: 12px 0;
}

.mt-4 {
  margin-top: 1rem;
}

.note-text {
  position: relative;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.note-text:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
