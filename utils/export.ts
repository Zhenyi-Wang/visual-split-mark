import { audioProcessor } from './audio'
import { loadBlob } from './file'
import type { AudioFile, Annotation } from '~/types/project'

export interface ExportData {
  audioFile: AudioFile
  annotations: Annotation[]
  segments: Array<{
    id: string
    start: number
    end: number
    text: string
    wavBlob: Blob
  }>
}

/**
 * 导出音频片段和标注数据
 */
export async function exportAudioSegments(audioFile: AudioFile, annotations: Annotation[]): Promise<ExportData> {
  // 加载音频文件
  const blob = await loadBlob(audioFile.wavPath)
  if (!blob) {
    throw new Error('Failed to load audio file')
  }

  // 加载 FFmpeg
  await audioProcessor.load()

  // 分割音频
  const segments = await Promise.all(
    annotations.map(async (annotation) => {
      const wavBlob = await audioProcessor.extractSegment(
        blob,
        annotation.start,
        annotation.end
      )

      return {
        id: annotation.id,
        start: annotation.start,
        end: annotation.end,
        text: annotation.text,
        wavBlob
      }
    })
  )

  return {
    audioFile,
    annotations,
    segments
  }
}

/**
 * 生成导出的 JSON 数据
 */
export function generateExportJson(data: ExportData) {
  return {
    audioFile: {
      id: data.audioFile.id,
      name: data.audioFile.originalName,
      duration: data.audioFile.duration
    },
    segments: data.annotations.map((annotation, index) => ({
      id: annotation.id,
      start: annotation.start,
      end: annotation.end,
      text: annotation.text,
      whisperText: annotation.whisperText,
      filename: `${index + 1}.wav`
    }))
  }
}

/**
 * 将数据打包为 zip 文件
 */
export async function createExportZip(data: ExportData): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  // 添加 JSON 文件
  zip.file('data.json', JSON.stringify(generateExportJson(data), null, 2))

  // 添加音频文件
  const audioFolder = zip.folder('audio')
  if (audioFolder) {
    for (let i = 0; i < data.segments.length; i++) {
      const segment = data.segments[i]
      audioFolder.file(`${i + 1}.wav`, segment.wavBlob)
    }
  }

  // 生成 zip 文件
  return zip.generateAsync({ type: 'blob' })
}

/**
 * 下载 Blob 数据
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
} 