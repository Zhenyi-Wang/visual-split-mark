import { useMessage } from 'naive-ui'
import { transcribeAudio, type WhisperResult } from '~/utils/whisper'
import type { Project, AudioFile, Annotation } from '~/types/project'

export function useWhisper() {
  const projectStore = useProjectStore()
  const message = useMessage()

  const transcribe = async (audioFile: AudioFile) => {
    const currentProject = projectStore.currentProject
    if (!currentProject) {
      throw new Error('No project selected')
    }

    if (!currentProject.whisperApiUrl) {
      throw new Error('Whisper API URL not configured')
    }

    // 调用 Whisper API
    const result = await transcribeAudio(currentProject, audioFile.wavPath)

    // 将识别结果转换为标注
    const annotations: Annotation[] = result.segments.map(segment => ({
      id: crypto.randomUUID(),
      audioFileId: audioFile.id,
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      whisperText: segment.text.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    }))

    // 批量保存标注
    await projectStore.updateAnnotations(annotations)

    return annotations
  }

  return {
    transcribe
  }
} 