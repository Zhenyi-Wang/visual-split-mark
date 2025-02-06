import type { AudioFile, Annotation } from '../types/project'
import type { ExportResponse, ExportConfig } from '../types/export'

export const exportManager = {
  // 导出文件
  async exportFile(
    projectName: string, 
    audioFile: AudioFile, 
    annotations: Annotation[],
    config: ExportConfig,
    onProgress?: (progress: number) => void
  ): Promise<ExportResponse> {
    // 1. 生成导出 ID (UUID)
    const exportId = crypto.randomUUID()
    
    // 2. 建立 SSE 连接
    const eventSource = new EventSource(`/api/export/progress?id=${exportId}`)
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      onProgress?.(data.progress)
      if (data.progress === 100) {
        eventSource.close()
      }
    }

    // 3. 发送导出请求
    const response = await $fetch<ExportResponse>('/api/export', {
      method: 'POST',
      body: {
        exportId,
        projectName,
        audioFile,
        annotations,
        config
      }
    })

    return response
  }
} 