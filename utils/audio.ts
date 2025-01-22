import type { AudioFile } from '~/types/project'
import { readFile } from 'node:fs/promises'

/**
 * 音频处理工具
 */
export const audioProcessor = {
  /**
   * 提取音频片段
   * @param audioFile 音频文件对象
   * @param audioData 音频数据（Buffer 或 Blob）
   * @param start 开始时间（秒）
   * @param end 结束时间（秒）
   */
  async extractSegment(
    audioFile: AudioFile,
    audioData: Buffer | Blob,
    start: number,
    end: number
  ): Promise<Blob> {
    try {
      // 调用音频提取 API
      const response = await $fetch<{ path: string }>('/api/audio/extract', {
        method: 'POST',
        body: {
          audioPath: audioFile.wavPath,
          start,
          end
        }
      })

      // 读取生成的文件
      const buffer = await readFile(response.path)
      
      // 转换为 Blob
      return new Blob([buffer], { type: 'audio/wav' })
      
    } catch (error) {
      console.error('Failed to extract audio segment:', error)
      throw error
    }
  }
}