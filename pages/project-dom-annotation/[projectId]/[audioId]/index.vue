<template>
  <div class="page-container">
    <n-space vertical size="large">
      <!-- 页面头部 -->
      <n-page-header @back="handleBack">
        <template #title>
          <n-space align="center">
            <span>{{ currentAudioFile?.originalName || '音频文件' }}</span>
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
            <n-button type="error" ghost @click="handleClearAll"
              :disabled="!domAnnotationStore.currentAnnotations.length">
              清除所有标注
            </n-button>
            <n-button type="primary" ghost @click="handleTranscribe" :loading="transcribing"
              :disabled="!currentProject?.whisperApiUrl">
              识别文本
            </n-button>
            <n-button type="primary" ghost @click="showExportModal = true"
              :disabled="!domAnnotationStore.currentAnnotations.length">
              导出数据集
            </n-button>
          </n-space>
        </template>
      </n-page-header>

      <!-- 主要内容区域 -->
      <div class="main-content" :class="{ 'no-select': domAnnotationStore.uiState.annotationState !== 'idle' }">
        <!-- 工具栏 -->
        <div class="toolbar">
          <n-space align="center">
            <!-- 播放控制 -->
            <n-button circle size="medium" title="播放/暂停" @click="togglePlay">
              <template #icon>
                <n-icon>
                  <IconPlay v-if="!isPlaying" />
                  <IconPause v-else />
                </n-icon>
              </template>
            </n-button>

            <!-- 时间显示 -->
            <n-text style="line-height: 34px">
              {{ domAnnotationStore.currentTimeFormatted }} / {{ domAnnotationStore.formattedDuration }}
            </n-text>

            <n-divider vertical style="height: 24px; margin: 5px 0" />

            <!-- 播放速率控制 -->
            <n-button-group>
              <n-button size="small" title="降低播放速率" @click="changePlaybackRate(-0.1)">
                <template #icon>
                  <n-icon>
                    <IconMinus />
                  </n-icon>
                </template>
              </n-button>
              <n-text style="padding: 0 8px; line-height: 34px">{{ playbackRate }}倍播放</n-text>
              <n-button size="small" title="提高播放速率" @click="changePlaybackRate(0.1)">
                <template #icon>
                  <n-icon>
                    <IconAdd />
                  </n-icon>
                </template>
              </n-button>
            </n-button-group>

            <n-divider vertical style="height: 24px; margin: 5px 0" />

            <!-- 音量控制 -->
            <n-space align="center">
              <n-text style="line-height: 34px">音量:</n-text>
              <n-slider
                v-model:value="volume"
                :min="0"
                :max="100"
                :step="1"
                style="width: 120px"
                @update:value="handleVolumeChange"
              />
              <n-text style="padding: 0 8px; line-height: 34px">{{ volume }}%</n-text>
            </n-space>

            <n-divider vertical style="height: 24px; margin: 5px 0" />

            <!-- 缩放控制 -->
            <n-space align="center">
              <n-text style="line-height: 34px">缩放控制:</n-text>
              <ZoomControlDOM />
            </n-space>
          </n-space>

        </div>

        <!-- 内容容器 -->
        <div class="content-container">
          <!-- 视口容器 - 固定尺寸，不需要滚动 -->
          <div class="viewport-container" ref="scrollContainerRef">
            <!-- 时间轴 -->
            <div class="timeline">
              <div v-for="time in timeMarkers" :key="time" class="timeline-marker"
                :style="{ left: `${timeToPixel(time)}px` }">
                <div class="timeline-label">{{ formatTimeAxis(time) }}</div>
              </div>
            </div>

            <!-- 波形区 - 固定尺寸 -->
            <div class="waveform-area">
              <WaveformDOMCanvas v-if="domAnnotationStore.waveformCache.loaded"
                @waveformClick="handleWaveformComponentClick" />
              <div v-else class="wave-placeholder">
                <n-spin size="medium" />
                <div class="loading-info">
                  <div>{{ loadingStatus }}</div>
                  <n-progress type="line" :percentage="loadingProgress" :show-indicator="false" />
                </div>
              </div>
            </div>

            <!-- 播放指示器 - 只在视口范围内显示 -->
            <div class="playhead" v-show="isPlayheadVisible">
              <div class="playhead-line"></div>
              <div class="playhead-marker"></div>
            </div>

            <!-- 标注区 - 固定尺寸 -->
            <AnnotationAreaDOM :audio-player="audioPlayer" />
          </div>
        </div>

        <!-- 时间范围选择器 -->
        <div class="time-range-selector-container">
          <TimeRangeSelectorDOM />
        </div>
      </div>
    </n-space>
  </div>

    <!-- 导出配置对话框 -->
    <n-modal v-model:show="showExportModal" preset="card" title="导出数据集" style="width: 500px" :closable="true"
      :mask-closable="false">
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
                    <n-input-number v-model:value="exportConfig.maxDuration" :min="1" :max="120" size="small"
                      style="width: 100px" />
                    <n-text>秒</n-text>
                  </n-space>
                  <n-text depth="3" style="margin-left: 24px">
                    合并后的音频片段不会超过此时长。在严格模式下，只有间隔小于最大间隔的标注才会合并；在宽松模式下，只要合并后不超过此时长即可合并。
                  </n-text>
                </n-space>
              </n-form-item>

              <n-form-item label="合并方式">
                <n-space vertical>
                  <n-radio-group v-model:value="exportConfig.mergeOnlyConsecutive">
                    <n-space vertical>
                      <n-radio :value="false">
                        宽松：合并任意相邻标注（不限间隔）
                      </n-radio>
                      <n-radio :value="true">
                        严格：仅合并间隔小于指定时长的标注
                      </n-radio>
                    </n-space>
                  </n-radio-group>

                  <div style="margin-left: 32px" v-if="exportConfig.mergeOnlyConsecutive">
                    <n-form-item label="最大间隔">
                      <n-space align="center">
                        <n-input-number v-model:value="exportConfig.maxGap" :min="0.1" :max="5" :step="0.1" size="small"
                          style="width: 100px" />
                        <n-text>秒</n-text>
                      </n-space>
                    </n-form-item>
                  </div>

                  <div style="margin-left: 32px" v-if="!exportConfig.mergeOnlyConsecutive">
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
          <n-button type="primary" @click="handleStartExport">开始导出</n-button>
        </n-space>
      </n-space>
    </n-modal>

    <!-- 导出进度对话框 -->
    <n-modal v-model:show="showExportProgress" preset="card" title="导出进度" style="width: 600px" :closable="false"
      :mask-closable="false">
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
                    ? `严格（间隔 < ${exportConfig.maxGap}秒）` : exportConfig.keepGaps ? '宽松（保留间隔）' : '宽松（移除间隔）' }}
                  </n-descriptions-item>
            </template>
          </n-descriptions>
        </n-card>

        <n-divider />

        <!-- 进度显示 -->
        <template v-if="status === 'exporting'">
          <n-progress type="line" :percentage="progress" :show-indicator="true" :processing="true"
            indicator-placement="inside">
            正在导出 {{ progress }}%
          </n-progress>
        </template>

        <template v-else-if="status === 'completed'">
          <n-result status="success" title="导出成功" description="数据集已导出到以下目录：">
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
          <n-result status="error" title="导出失败" :description="exportError" />
        </template>
      </n-space>

      <template #footer>
        <n-space justify="end">
          <n-button @click="handleCloseExportProgress" :disabled="status === 'exporting'">
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
  <n-modal v-model:show="showTranscribeResultModal" preset="card" title="识别结果" style="width: 500px" :closable="true"
      :mask-closable="false">
      <n-space vertical>
        <n-result :status="transcribeResult.success ? 'success' : 'error'"
          :title="transcribeResult.success ? '识别成功' : '识别失败'" :description="transcribeResult.success
              ? `文本识别完成，共识别出 ${transcribeResult.count} 个片段。`
              : transcribeResult.message
            " />
        <n-space justify="end">
          <n-button type="primary" @click="showTranscribeResultModal = false">
            {{ transcribeResult.success ? '确认' : '关闭' }}
          </n-button>
        </n-space>
      </n-space>
    </n-modal>

  <!-- 添加识别确认对话框 -->
  <n-modal v-model:show="showTranscribeConfirmModal" preset="dialog" title="确认识别文本" type="warning" :show-icon="true">
    <n-space vertical>
      <div>此操作将使用 Whisper API 识别音频中的文本。</div>
      <template v-if="domAnnotationStore.currentAnnotations.length > 0">
        <n-alert type="warning" :show-icon="true">
          <template #header>
            <span style="font-weight: 500">当前音频已有 {{ domAnnotationStore.currentAnnotations.length }} 条标注</span>
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
        <n-button type="warning" @click="handleConfirmTranscribe">开始识别</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 添加清除所有标注确认对话框 -->
  <n-modal v-model:show="showClearAllModal" preset="dialog" title="清除所有标注" type="error" :show-icon="true">
    <template #default>
      <n-space vertical>
        <div>确定要清除当前音频的所有标注吗？</div>
        <n-alert type="error" :show-icon="true">
          <template #header>
            <span style="font-weight: 500">此操作将删除 {{ domAnnotationStore.currentAnnotations.length }} 条标注</span>
          </template>
          此操作不可恢复，请谨慎操作。
        </n-alert>
      </n-space>
    </template>
    <template #action>
      <n-space>
        <n-button @click="showClearAllModal = false">取消</n-button>
        <n-button type="error" @click="handleConfirmClearAll">确定清除</n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- 添加备注编辑对话框 -->
  <n-modal v-model:show="showNoteModal" preset="dialog" title="编辑备注">
    <n-input
      v-model:value="noteText"
      type="textarea"
      placeholder="请输入备注"
      :autosize="{ minRows: 3, maxRows: 5 }"
    />
    <template #action>
      <n-space>
        <n-button @click="showNoteModal = false">取消</n-button>
        <n-button type="primary" @click="handleSaveNote">保存</n-button>
      </n-space>
    </template>
  </n-modal>

</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useProjectStore } from '~/stores/project'
import { useDOMAnnotationStore } from '~/stores/domAnnotation'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useExport } from '~/composables/useExport'
import { useThrottleFn } from '@vueuse/core'
import { loadAudioBlobWithProgress } from '~/utils/file'
import WaveformDOMCanvas from '~/components/WaveformDOMCanvas.vue'
import TimeRangeSelectorDOM from '~/components/TimeRangeSelectorDOM.vue'
import AnnotationAreaDOM from '~/components/AnnotationAreaDOM.vue'
import {
  Play as IconPlay,
  Pause as IconPause,
  Add as IconAdd,
  Minus as IconMinus,
  ZoomIn as IconZoomIn,
  ZoomOut as IconZoomOut
} from '@icon-park/vue-next'

// 路由和状态管理
const route = useRoute()
const router = useRouter()
const message = useMessage()
const projectStore = useProjectStore()
const domAnnotationStore = useDOMAnnotationStore()
const audioPlayer = useAudioPlayer()

// 视口状态存储相关函数
const getViewportStorageKey = (): string => {
  const projectId = route.params.projectId as string
  const audioId = route.params.audioId as string
  return `domViewportState-${projectId}-${audioId}`
}

const saveViewportState = () => {
  if (!domAnnotationStore.currentAudioFile) return // 确保音频文件已加载，避免无效保存

  const stateToSave = {
    startTime: domAnnotationStore.viewportState.startTime,
    endTime: domAnnotationStore.viewportState.endTime,
    pixelsPerSecond: domAnnotationStore.viewportState.pixelsPerSecond,
    volume: audioPlayer.volume.value,
  }
  localStorage.setItem(getViewportStorageKey(), JSON.stringify(stateToSave))
}

// 使用节流函数避免频繁保存
const throttledSaveViewportState = useThrottleFn(saveViewportState, 500) // 每500ms最多保存一次

// 监听视口状态变化以保存
watch(
  () => domAnnotationStore.viewportState,
  () => {
    throttledSaveViewportState()
  },
  { deep: true }
)

// 组件卸载前确保最后的状态被保存
onBeforeUnmount(() => {
  saveViewportState() // 直接保存，不节流
})

// 引用和状态变量
const scrollContainerRef = ref<HTMLElement | null>(null)
const selectedAnnotationId = ref<string | null>(null)
const loadingProgress = ref(0)
const loadingStatus = ref('正在初始化...')
const playbackRate = ref(1.0)
const isPlaying = ref(false)
const volume = ref(100)
let playheadUpdateTimer: number | null = null
const transcribing = ref(false)
const showExportModal = ref(false)


// 页面尺寸监听 - 视口大小变化时更新状态
const updateViewportSize = () => {
  if (scrollContainerRef.value) {
    const width = scrollContainerRef.value.clientWidth
    domAnnotationStore.changeContainerWidth(width)
  }
}

// 监听窗口大小变化
const handleResize = () => {
  updateViewportSize()
}

// 监听视口大小变化
watch(scrollContainerRef, () => {
  updateViewportSize()
})

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

// 导出相关的状态
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

// 添加确认清除所有标注的处理函数
const handleConfirmClearAll = async () => {
  showClearAllModal.value = false
  try {
    // 清除所有标注
    await domAnnotationStore.clearAllAnnotations()
    message.success('所有标注已清除')
  } catch (error) {
    message.error('清除标注失败')
  }
}


// 添加清除所有标注确认对话框的状态
const showClearAllModal = ref(false)

// 添加清除所有标注的处理函数
const handleClearAll = () => {
  showClearAllModal.value = true
}

// 添加备注相关的状态
const showNoteModal = ref(false)
const noteText = ref('')

// 添加编辑备注的处理函数
const handleEditNote = () => {
  noteText.value = currentAudioFile.value?.note || ''
  showNoteModal.value = true
}

// 添加保存备注的处理函数
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

const { transcribe } = useWhisper()

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

// 计算属性
const currentProject = computed(() => projectStore.currentProject)
const currentAudioFile = computed(() => projectStore.currentAudioFile)

// 生成时间刻度标记
const timeMarkers = computed(() => {
  const { startTime, endTime, containerWidth, pixelsPerSecond } = domAnnotationStore.viewportState
  const duration = endTime - startTime
  const markers = []

  // 根据持续时间和像素密度生成合适的标记间隔
  let interval = 5 // 默认5秒一个标记

  // 根据像素密度和持续时间动态调整间隔
  if (pixelsPerSecond < 2) { // 非常低的分辨率
    interval = 300 // 5分钟一个标记
  } else if (pixelsPerSecond < 5) { // 低分辨率
    interval = 120 // 2分钟一个标记
  } else if (pixelsPerSecond < 10) { // 中低分辨率
    interval = 60 // 1分钟一个标记
  } else if (pixelsPerSecond < 20) { // 中等分辨率
    interval = 30 // 30秒一个标记
  } else if (pixelsPerSecond < 40) { // 中高分辨率
    interval = 15 // 15秒一个标记
  } else if (pixelsPerSecond < 80) { // 高分辨率
    interval = 5 // 5秒一个标记
  } else if (pixelsPerSecond < 160) { // 超高分辨率
    interval = 2 // 2秒一个标记
  } else { // 超高分辨率
    interval = 1 // 1秒一个标记
  }

  // 计算第一个标记位置（确保在视图范围内）
  const firstMarker = Math.ceil(startTime / interval) * interval

  // 计算最后一个标记位置（确保不超出视图范围）
  const lastMarker = Math.floor(endTime / interval) * interval

  // 生成标记
  for (let time = firstMarker; time <= lastMarker; time += interval) {
    markers.push(time)
  }

  // 如果标记太少，可以添加中间标记
  if (markers.length < 3 && interval > 1) {
    const halfInterval = interval / 2
    for (let time = firstMarker + halfInterval; time < lastMarker; time += interval) {
      markers.push(time)
    }
    // 重新排序
    markers.sort((a, b) => a - b)
  }

  return markers
})

// 将时间转换为像素位置
const timeToPixel = (time: number) => {
  const { startTime, endTime } = domAnnotationStore.viewportState
  const viewDuration = endTime - startTime
  return ((time - startTime) / viewDuration) * domAnnotationStore.viewportState.containerWidth
}

// 格式化时间轴刻度显示
const formatTimeAxis = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${remainingSeconds}s`
  }
}

// 计算播放头可见性
const isPlayheadVisible = computed(() => {
  const { startTime, endTime } = domAnnotationStore.viewportState
  const currentTime = audioPlayer.currentTime.value

  // 播放头只在视口范围内显示
  return currentTime >= startTime && currentTime <= endTime
})

// 计算播放头位置
const playheadPosition = computed(() => {
  const { startTime, endTime, containerWidth } = domAnnotationStore.viewportState
  const currentTime = audioPlayer.currentTime.value

  // 如果当前时间在视口范围内，计算相对位置
  if (currentTime >= startTime && currentTime <= endTime) {
    const viewDuration = endTime - startTime
    const position = ((currentTime - startTime) / viewDuration) * containerWidth - (containerWidth / 2)
    return `translateX(${position}px)`
  }

  // 如果当前时间不在视口范围内，不显示（实际值不重要，因为用v-show控制了可见性）
  return 'translateX(0px)'
})

// 页面加载时的初始化
onMounted(async () => {
  console.log('开始加载DOM标注页面数据')

  // 清空音频和标注的缓存
  domAnnotationStore.initialize()
  console.log('已清空音频和标注缓存')

  try {
    // 初始化项目数据
    loadingStatus.value = '正在加载项目数据...'
    loadingProgress.value = 10
    await projectStore.initialize()
    console.log('项目列表初始化完成')

    // 获取项目和音频文件数据
    const projectId = route.params.projectId as string
    const audioId = route.params.audioId as string

    loadingStatus.value = '正在加载项目详情...'
    loadingProgress.value = 20
    await projectStore.loadProject(projectId)

    // 获取音频文件
    const audioFile = projectStore.audioFiles.find(f => f.id === audioId)
    if (!audioFile) {
      throw new Error('未找到音频文件')
    }

    // 设置当前音频文件
    loadingStatus.value = '正在加载标注数据...'
    loadingProgress.value = 30
    projectStore.setCurrentAudioFile(audioFile)

    // 初始化视口尺寸
    updateViewportSize()
    window.addEventListener('resize', handleResize)

    // 加载音频文件
    try {
      loadingStatus.value = '正在加载音频文件...'
      loadingProgress.value = 40
      console.log('开始加载音频文件:', audioFile.wavPath)

      // 监听音频播放器进度变化
      watch(audioPlayer.loadingProgress, (progress) => {
        // 根据加载阶段计算总进度
        const phase = audioPlayer.loadingPhase.value
        let totalProgress = 0
        
        if (phase === 'downloading') {
          // 下载阶段：0-50%
          totalProgress = 40 + (progress * 0.5) // 从40%开始，到90%结束
        } else if (phase === 'decoding') {
          // 解码阶段：50-100%
          totalProgress = 40 + 50 + (progress * 0.1) // 从90%开始，到100%结束
        } else if (phase === 'ready') {
          totalProgress = 100
        }
        
        loadingProgress.value = Math.round(totalProgress)
        
        // 更新状态文本
        if (phase === 'downloading') {
          loadingStatus.value = `正在下载音频文件... ${Math.round(progress)}%`
        } else if (phase === 'decoding') {
          loadingStatus.value = `正在解码音频... ${Math.round(progress)}%`
        } else if (phase === 'ready') {
          loadingStatus.value = '加载完成'
        }
      })

      // 初始化音频播放器
      const channelData = await audioPlayer.initialize(audioFile)

      // 监听播放状态变化
      watch(audioPlayer.isPlaying, (playing) => {
        isPlaying.value = playing
        domAnnotationStore.setPlayingState(playing)
      })

      // 监听当前播放时间变化
      watch(audioPlayer.currentTime, (time) => {
        domAnnotationStore.setCurrentTime(time)

        // 自动跟随模式：当播放头接近视口边缘时自动滚动
        if (isPlaying.value) {
          const { startTime, endTime } = domAnnotationStore.viewportState
          const viewDuration = endTime - startTime
          const rightEdgeThreshold = viewDuration * 0.1 // 设置10%的右边缘阈值
          const leftEdgeThreshold = viewDuration * 0.1 // 设置10%的左边缘阈值

          // 如果接近右边缘，跳转视图，使播放头位于视图左侧10%位置
          if (time > endTime - rightEdgeThreshold) {
            // console.log('播放头接近右边缘，重新定位视图')

            // 计算新的起始时间，使播放头位于视图左侧10%位置
            let newStartTime = time - viewDuration * 0.1
            let newEndTime = newStartTime + viewDuration

            // 边界处理
            if (newEndTime > audioPlayer.duration.value) {
              newStartTime = audioPlayer.duration.value - viewDuration
              newEndTime = audioPlayer.duration.value
            }

            domAnnotationStore.moveAndZoomView(newStartTime, newEndTime)
          }
        }
      })

      // 监听播放速率变化
      watch(audioPlayer.playbackRate, (rate) => {
        playbackRate.value = rate
        domAnnotationStore.setPlaybackRate(rate)
      })

      // 监听音量变化
      watch(audioPlayer.volume, (vol) => {
        volume.value = Math.round(vol * 100)
        // 音量变化时保存视口状态
        throttledSaveViewportState()
      })

      // 更新音频文件时长（如果与实际不符）
      if (audioFile.duration !== audioPlayer.duration.value) {
        console.warn(`实际音频时长${audioPlayer.duration.value}秒与项目中的时长${audioFile.duration}秒不一致，音频id:${audioFile.id}`)
        console.warn(`更新项目中的音频时长`)
        
        // 更新本地变量中的时长
        audioFile.duration = audioPlayer.duration.value
        
        // 将更新后的音频文件信息保存到持久化存储中
        try {
          await projectStore.updateAudioFile({
            ...audioFile,
            duration: audioPlayer.duration.value,
            updatedAt: new Date()
          })
          message.success('音频时长已更新')
        } catch (error) {
          console.error('更新音频时长失败:', error)
          message.error('更新音频时长失败')
        }
      } else {
        // 时长一致，不需要更新
        audioFile.duration = audioPlayer.duration.value
      }

      // 缓存音频数据
      domAnnotationStore.cacheWaveformData(channelData, audioPlayer.audioContext.value?.sampleRate || 44100, audioPlayer.duration.value)

      // 尝试恢复保存的视口状态
      
      // 清除之前保存的错误数据（临时调试用）
      // localStorage.removeItem(getViewportStorageKey())
      
      // 尝试从本地存储恢复视口状态
      const savedStateJSON = localStorage.getItem(getViewportStorageKey())
      let viewportRestored = false
      
      if (savedStateJSON) {
        try {
          const savedState = JSON.parse(savedStateJSON)
          if (
            typeof savedState.startTime === 'number' &&
            typeof savedState.endTime === 'number' &&
            typeof savedState.pixelsPerSecond === 'number' &&
            savedState.endTime > savedState.startTime // 基本的有效性检查
          ) {
            // 确保恢复的值在合理范围内
            const duration = audioPlayer.duration.value;
            const validStartTime = Math.max(0, Math.min(savedState.startTime, duration));
            const validEndTime = Math.max(validStartTime + 0.1, Math.min(savedState.endTime, duration));
            const validPixelsPerSecond = Math.max(1, savedState.pixelsPerSecond); // 假设最小1px/s
            
            if (validEndTime > validStartTime) {
              // 先设置缩放级别，再设置视口范围
              domAnnotationStore.viewportState.pixelsPerSecond = validPixelsPerSecond;
              domAnnotationStore.moveAndZoomView(validStartTime, validEndTime);
              viewportRestored = true;
              
              // 恢复音量设置
              if (typeof savedState.volume === 'number' && savedState.volume >= 0 && savedState.volume <= 1) {
                audioPlayer.setVolume(savedState.volume);
                volume.value = Math.round(savedState.volume * 100);
              }
            }
          }
        } catch (e) {
          console.error('解析或应用保存的视口状态失败:', e)
          localStorage.removeItem(getViewportStorageKey()) // 清除无效数据
        }
      }
      
      // 如果没有恢复视口状态，则设置默认视口范围
      if (!viewportRestored) {
        // 设置初始视口范围 - 显示前30秒，或整个音频（如果少于30秒）
        console.log('使用默认视口范围')
        const initialDuration = Math.min(30, audioPlayer.duration.value)
        domAnnotationStore.moveAndZoomView(0, initialDuration)
      }
      
      // 音频加载完成后的最终处理
      loadingStatus.value = '加载完成'
      loadingProgress.value = 100
      
    } catch (error) {
      console.error('音频文件加载失败:', error)
      message.error('音频文件加载失败，请重试')
      loadingStatus.value = '音频文件加载失败'
    }

  } catch (error) {
    console.error('DOM标注页面加载失败:', error)
    message.error('加载失败，请重试')
    loadingStatus.value = '加载失败'
  }

  // 设置播放头更新定时器
  playheadUpdateTimer = window.setInterval(() => {
    if (isPlaying.value) {
      // 强制重新计算播放头位置
      const dummy = Date.now()
    }
  }, 50) // 每50毫秒更新一次

  // 注册键盘事件
  window.addEventListener('keydown', handleKeydown)
})

// 组件卸载时清理事件监听和缓存
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  // 清空缓存，避免内存泄漏
  domAnnotationStore.clearWaveformCache()
  // 销毁音频播放器
  audioPlayer.destroy()
  // 清除定时器
  if (playheadUpdateTimer !== null) {
    window.clearInterval(playheadUpdateTimer)
  }
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)
})

// 播放控制函数
const togglePlay = async () => {
  await audioPlayer.playPause()
  // console.log('播放状态:', audioPlayer.isPlaying.value, domAnnotationStore.playbackState.isPlaying)
}

// 处理键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  // 空格键控制播放/暂停，但在编辑标注时不触发
  if (event.code === 'Space' && !event.repeat) {
    // 检查当前是否处于标注编辑状态
    const annotationState = domAnnotationStore.uiState.annotationState
    if (['creating_edit', 'editing_text'].includes(annotationState)) {
      // 在编辑状态下，不触发播放/暂停
      return
    }

    // 阻止默认行为（滚动页面等）
    event.preventDefault()
    togglePlay()
  }
}

// 调整播放速率
const changePlaybackRate = (delta: number) => {
  const newRate = Math.max(0.5, Math.min(2.0, playbackRate.value + delta))
  audioPlayer.setPlaybackRate(newRate)
}

// 调整音量
const handleVolumeChange = (value: number) => {
  audioPlayer.setVolume(value / 100)
}

// 波形图组件点击跳转
const handleWaveformComponentClick = (event: MouseEvent) => {
  if (!scrollContainerRef.value) return

  // 计算点击位置对应的时间
  const containerRect = scrollContainerRef.value.getBoundingClientRect()
  const waveformRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const offsetX = event.clientX - waveformRect.left
  const containerWidth = waveformRect.width

  // 计算时间点
  const { startTime, endTime } = domAnnotationStore.viewportState
  const viewDuration = endTime - startTime
  const clickTime = startTime + (offsetX / containerWidth) * viewDuration

  // 跳转到指定时间
  audioPlayer.seek(clickTime)
}

// 波形图点击跳转
const handleWaveformClick = (event: MouseEvent) => {
  if (!scrollContainerRef.value) return

  // 计算点击位置对应的时间
  const containerRect = scrollContainerRef.value.getBoundingClientRect()
  const offsetX = event.clientX - containerRect.left
  const containerWidth = containerRect.width

  // 计算时间点
  const { startTime, endTime } = domAnnotationStore.viewportState
  const viewDuration = endTime - startTime
  const clickTime = startTime + (offsetX / containerWidth) * viewDuration

  // 跳转到指定时间
  audioPlayer.seek(clickTime)
}

// 返回按钮处理
const handleBack = () => {
  router.push(`/project/${route.params.projectId}`)
}

// 页面标题设置
useHead({
  title: computed(() => `${currentAudioFile.value?.originalName || '音频文件'} - Visual Split Mark`),
})
</script>

<style scoped>
.page-container {
  position: relative;
}

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

.content-container {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  min-height: 0;
}

.viewport-container {
  position: relative;
  overflow: hidden;
  height: 100%;
}

.timeline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  border-bottom: 1px solid #eee;
  z-index: 1;
}

.timeline-marker {
  position: absolute;
  width: 1px;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.1);
}

.timeline-label {
  position: absolute;
  top: 2px;
  transform: translateX(-50%);
  font-size: 10px;
  color: #666;
  white-space: nowrap;
}

.timeline-marker:first-child .timeline-label {
  transform: translateX(0);
  text-align: left;
}

.timeline-marker:last-child .timeline-label {
  transform: translateX(-100%);
  text-align: right;
}

.waveform-area {
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  height: 150px;
  z-index: 1;
}

.playhead {
  position: absolute;
  top: 0;
  left: 50%;
  height: 100%;
  width: 1px;
  z-index: 5;
  pointer-events: none;
  transform: v-bind('playheadPosition');
}

.playhead-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 100%;
  background-color: red;
}

.playhead-marker {
  position: absolute;
  top: 0;
  left: -5px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background-color: red;
}

.time-range-selector-container {
  padding: 0;
  background-color: #fff;
  border-radius: 4px;
}

.wave-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.loading-info {
  margin-top: 16px;
  text-align: center;
}

.no-select {
  user-select: none
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