import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { exportManager, progressEmitter } from '../utils/export'
import type { AudioFile, Annotation } from '../types/project'
import { useProjectStore } from '../stores/project'

export function useExport() {
  const progress = ref(0)
  const status = ref<'idle' | 'exporting' | 'completed' | 'failed'>('idle')
  const message = useMessage()
  const projectStore = useProjectStore()
  
  const exportAnnotations = async (projectName: string, audioFile: AudioFile) => {
    if (!audioFile) return
    
    try {
      status.value = 'exporting'
      progress.value = 0
      
      // 获取标注数据
      const annotations = projectStore.annotations
        .filter((a: Annotation) => a.audioFileId === audioFile.id)
      
      if (!annotations.length) {
        throw new Error('没有找到标注数据')
      }
      
      // 开始导出
      const result = await exportManager.exportFile(
        projectName,
        audioFile,
        annotations
      )
      
      status.value = 'completed'
      return result
      
    } catch (error: unknown) {
      status.value = 'failed'
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error('导出失败：' + errorMessage)
      throw error
    }
  }
  
  // 监听导出进度
  progressEmitter.on('progress', (dirname: string, value: number) => {
    progress.value = value
  })
  
  return {
    exportAnnotations,
    progress,
    status
  }
} 