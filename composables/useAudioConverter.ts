import { ref } from 'vue'
import type { AudioFile } from '~/types/project'

export const useAudioConverter = () => {
  const converting = ref(false)

  const deleteFile = async (audioFile: AudioFile) => {
    try {
      // 删除原始文件
      if (audioFile.originalPath) {
        await $fetch('/api/file/delete', {
          method: 'POST',
          body: { path: audioFile.originalPath }
        })
      }
      // 删除转换后的文件
      if (audioFile.wavPath) {
        await $fetch('/api/file/delete', {
          method: 'POST',
          body: { path: audioFile.wavPath }
        })
      }
    } catch (error) {
      console.error('Error deleting audio files:', error)
      throw error
    }
  }

  return {
    converting,
    deleteFile
  }
} 