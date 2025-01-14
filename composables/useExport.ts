import { useMessage } from 'naive-ui'
import { exportAudioSegments, createExportZip, downloadBlob } from '~/utils/export'
import type { AudioFile } from '~/types/project'

export function useExport() {
  const projectStore = useProjectStore()
  const message = useMessage()

  const exportAnnotations = async (audioFile: AudioFile) => {
    try {
      // 获取标注数据
      const annotations = projectStore.annotations.filter(a => a.audioFileId === audioFile.id)
      if (!annotations.length) {
        throw new Error('No annotations found')
      }

      // 导出音频片段和标注数据
      const exportData = await exportAudioSegments(audioFile, annotations)

      // 创建 zip 文件
      const zipBlob = await createExportZip(exportData)

      // 下载文件
      const filename = audioFile.originalName.replace(/\.[^/.]+$/, '') + '_export.zip'
      downloadBlob(zipBlob, filename)

      message.success('导出成功')
    } catch (error) {
      console.error('Export failed:', error)
      if (error instanceof Error) {
        message.error(error.message)
      } else {
        message.error('导出失败')
      }
    }
  }

  return {
    exportAnnotations
  }
} 