import type { AudioFile } from '~/types/project'
import { ofetch } from 'ofetch'

/**
 * 音频处理工具
 */
export const audioProcessor = {
  /**
   * 从音频文件中提取片段
   */
  async extractSegment(audioFile: AudioFile, start: number, end: number): Promise<Blob> {
    try {
      const response = await ofetch<Blob>('/api/audio/extract', {
        method: 'POST',
        body: {
          audioPath: audioFile.wavPath,
          start,
          end
        }
      })
      return response
    } catch (error) {
      console.error('Failed to extract audio segment:', error)
      throw error
    }
  }
}