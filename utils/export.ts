import { EventEmitter } from 'events'
import type { AudioFile, Annotation } from '~/types/project'
import type { ExportResponse } from '~/types/export'

// 创建进度通知器
export const progressEmitter = new EventEmitter()

export const exportManager = {
  // 导出文件
  async exportFile(projectName: string, audioFile: AudioFile, annotations: Annotation[]): Promise<ExportResponse> {
    // 发送导出请求
    const response = await $fetch<ExportResponse>('/api/export', {
      method: 'POST',
      body: {
        projectName,
        audioFile,
        annotations
      }
    })

    // 设置 SSE 监听器
    const eventSource = new EventSource(`/api/export/progress?id=${response.dirname}`)
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      progressEmitter.emit('progress', response.dirname, data.progress)
      if (data.progress === 100) {
        eventSource.close()
      }
    }

    return response
  }
} 