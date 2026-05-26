import { useMessage } from 'naive-ui'
import { callTranscribeService, convertTranscribeResult } from '~/utils/transcribeService'
import type { Project, AudioFile, Annotation } from '~/types/project'

export function useTranscribeService() {
  const projectStore = useProjectStore()
  const message = useMessage()

  const transcribe = async (audioFile: AudioFile) => {
    const currentProject = projectStore.currentProject
    if (!currentProject) {
      throw new Error('No project selected')
    }

    if (!currentProject.transcribeApiUrl) {
      throw new Error('转录服务 API 地址未配置')
    }

    const result = await callTranscribeService(currentProject, audioFile.wavPath)
    const segments = convertTranscribeResult(result)

    const annotations: Annotation[] = segments.map(segment => ({
      id: crypto.randomUUID(),
      audioFileId: audioFile.id,
      start: segment.start,
      end: segment.end,
      text: segment.text,
      whisperText: segment.text,
      createdAt: new Date(),
      updatedAt: new Date()
    }))

    await projectStore.updateAnnotations(annotations)

    return annotations
  }

  return {
    transcribe
  }
}
