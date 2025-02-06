import { mkdir, writeFile } from 'node:fs/promises'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { format } from 'date-fns'
import { audioProcessor } from '~/utils/audio'
import type { AudioFile, Annotation } from '~/types/project'
import type { ExportResponse, ExportConfig, DatasetEntry } from '~/types/export'
import { EXPORT_CONSTANTS } from '~/types/export'
import { progressEmitter } from '../../utils/progress'
import { loadFile } from '../../utils/file'

// 添加时间戳处理函数
function formatTimestamp(time: number, duration: number): number {
  // 限制范围并保留2位小数
  return Number(Math.max(0, Math.min(duration, time)).toFixed(2))
}

// 标注合并函数
function mergeAnnotations(annotations: Annotation[], config: ExportConfig): {
  start: number
  end: number
  text: string
  sentences?: { start: number; end: number; text: string }[]
}[] {
  const result: {
    start: number
    end: number
    text: string
    sentences?: { start: number; end: number; text: string }[]
  }[] = []
  
  // 按开始时间排序
  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  
  let current = {
    start: sorted[0].start,
    end: sorted[0].end,
    text: sorted[0].text,
    actualDuration: sorted[0].end - sorted[0].start,  // 添加实际时长计数
    sentences: [{ start: sorted[0].start, end: sorted[0].end, text: sorted[0].text }] as { start: number; end: number; text: string }[]
  }
  
  for (let i = 1; i < sorted.length; i++) {
    const annotation = sorted[i]
    const gap = annotation.start - current.end
    const annotationDuration = annotation.end - annotation.start
    
    // 计算合并后的总时长（根据是否保留间隔）
    const mergedDuration = config.keepGaps
      ? annotation.end - current.start  // 保留间隔时使用完整时长
      : current.actualDuration + annotationDuration  // 不保留间隔时只计算实际语音时长
    
    // 判断是否可以合并
    const canMerge = config.mergeOnlyConsecutive
      ? gap < config.maxGap // 只合并连续的标注
      : mergedDuration <= config.maxDuration // 只考虑总时长限制
    
    // 如果可以合并，且总时长在限制范围内
    if (canMerge && mergedDuration <= config.maxDuration) {
      // 如果不保留间隔，更新文本和结束时间
      if (!config.keepGaps && gap > 0.01) {
        // 添加当前句子
        current.sentences.push({
          start: Number(current.actualDuration.toFixed(2)),
          end: Number((current.actualDuration + annotationDuration).toFixed(2)),
          text: annotation.text
        })
        // 更新结束时间、文本和实际时长
        current.end = current.end + annotationDuration
        current.text += annotation.text
        current.actualDuration += annotationDuration
      } else {
        // 保留间隔，直接添加
        current.end = annotation.end
        current.text += annotation.text
        current.actualDuration = annotation.end - current.start
        current.sentences.push({
          start: Number((annotation.start - current.start).toFixed(2)),
          end: Number((annotation.end - current.start).toFixed(2)),
          text: annotation.text
        })
      }
    } else {
      // 保存当前片段
      const entry = {
        start: current.start,
        end: current.end,
        text: current.text
      }
      // 如果有多个句子，添加 sentences 字段
      if (current.sentences.length > 1) {
        result.push({ ...entry, sentences: current.sentences })
      } else {
        result.push(entry)
      }
      
      // 开始新的片段
      current = {
        start: annotation.start,
        end: annotation.end,
        text: annotation.text,
        actualDuration: annotationDuration,
        sentences: [{ start: 0, end: annotation.end - annotation.start, text: annotation.text }]
      }
    }
  }
  
  // 处理最后一个片段
  const entry = {
    start: current.start,
    end: current.end,
    text: current.text
  }
  // 如果有多个句子，添加 sentences 字段
  if (current.sentences.length > 1) {
    result.push({ ...entry, sentences: current.sentences })
  } else {
    result.push(entry)
  }
  
  return result
}

export default defineEventHandler(async (event): Promise<ExportResponse> => {
  const { exportId, projectName, audioFile, annotations, config } = await readBody(
    event
  )

  // 使用时间戳_项目名_音频文件名作为目录名
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
  // 只过滤文件系统禁止的字符: \ / : * ? " < > |
  const sanitizedProjectName = projectName.replace(/[\\/:*?"<>|]/g, '_')
  const sanitizedAudioName = audioFile.originalName
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.[^/.]+$/, '')
  const dirname = `${timestamp}_${sanitizedProjectName}_${sanitizedAudioName}`
  
  // 确保导出根目录存在
  const exportRoot = resolve(process.cwd(), 'storage/exports')
  await mkdir(exportRoot, { recursive: true })
  
  const exportPath = resolve(exportRoot, dirname)
  const datasetPath = resolve(exportPath, 'dataset')

  try {
    // 创建导出目录
    await mkdir(datasetPath, { recursive: true })

    // 准备数据集
    const dataset: DatasetEntry[] = []
    
    // 根据配置决定是否合并标注
    const processAnnotations = config?.mergeSentences
      ? mergeAnnotations(annotations, config)
      : annotations.map((a: Annotation) => ({
          start: a.start,
          end: a.end,
          text: a.text
        }))
    
    const total = processAnnotations.length

    // 处理每个标注或合并后的标注组
    let totalDuration = 0
    for (let i = 0; i < processAnnotations.length; i++) {
      const annotation = processAnnotations[i]
      const uuid = crypto.randomUUID()
      const wavPath = resolve(datasetPath, `${uuid}.wav`)

      console.log(`处理第 ${i + 1}/${total} 个标注:`, {
        start: annotation.start,
        end: annotation.end,
        text: annotation.text,
      })

      // 如果是合并的标注且不保留间隔
      if (config?.mergeSentences && !config.keepGaps && annotation.sentences && annotation.sentences.length > 1) {
        // 为每个句子创建临时文件
        const tempFiles = []
        for (const sentence of annotation.sentences) {
          const tempPath = resolve(datasetPath, `temp_${crypto.randomUUID()}.wav`)
          // 提取每个句子的音频
          const response = await $fetch<{
            success: boolean
            data: { path: string }
          }>('/api/audio/extract', {
            method: 'POST',
            body: {
              audioPath: audioFile.wavPath,
              start: sentence.start + annotation.start,
              end: sentence.end + annotation.start,
              outputPath: tempPath
            },
          })
          if (!response?.success) {
            throw new Error('音频提取失败')
          }
          tempFiles.push(tempPath)
        }

        // 合并所有临时文件
        const response = await $fetch<{
          success: boolean
          data: { path: string }
        }>('/api/audio/concat', {
          method: 'POST',
          body: {
            inputPaths: tempFiles,
            outputPath: wavPath
          },
        })

        if (!response?.success) {
          throw new Error('音频合并失败')
        }

        // 删除临时文件
        for (const tempFile of tempFiles) {
          try {
            await rm(tempFile)
          } catch (e) {
            console.error('删除临时文件失败:', e)
          }
        }
      } else {
        // 直接提取音频片段
        const response = await $fetch<{
          success: boolean
          data: { path: string }
        }>('/api/audio/extract', {
          method: 'POST',
          body: {
            audioPath: audioFile.wavPath,
            start: annotation.start,
            end: annotation.end,
            outputPath: wavPath
          },
        })

        if (!response?.success) {
          throw new Error('音频提取失败')
        }
      }

      console.log('音频片段已保存:', wavPath)

      const duration = Number((annotation.end - annotation.start).toFixed(2))
      totalDuration += duration

      // 添加数据集条目
      const entry: DatasetEntry = {
        audio: {
          path: `dataset/${uuid}.wav`,
        },
        sentence: annotation.text,
        language: 'Chinese',
        duration
      }

      // 如果启用了时间戳模式且有多个句子，添加 sentences 字段
      if (config?.includeTimestamps && annotation.sentences && annotation.sentences.length > 1) {
        entry.sentences = annotation.sentences.map((s: { start: number; end: number; text: string }) => ({
          start: formatTimestamp(s.start, duration),
          end: formatTimestamp(s.end, duration),
          text: s.text
        }))
      }

      dataset.push(entry)

      // 发送进度通知
      progressEmitter.emit(
        'progress',
        exportId,
        Math.round(((i + 1) / total) * 100)
      )
    }

    // 保存数据集 JSON 文件
    const jsonPath = resolve(exportPath, 'dataset.json')
    // 将每个数据条目转换为一行 JSON，并用换行符连接
    const jsonlContent = dataset.map(item => JSON.stringify(item)).join('\n')
    await writeFile(jsonPath, jsonlContent)
    console.log('数据集 JSONL 已保存:', jsonPath)

    // 保存配置文件
    const configPath = resolve(exportPath, 'config.json')
    const configData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      projectName,
      audioFile: {
        name: audioFile.originalName,
        duration: audioFile.duration
      },
      config,
      stats: {
        totalAnnotations: annotations.length,
        exportedSegments: processAnnotations.length,
        totalDuration
      }
    }
    await writeFile(configPath, JSON.stringify(configData, null, 2))
    console.log('配置文件已保存:', configPath)

    const response: ExportResponse = {
      dirname,
      path: exportPath,
      count: processAnnotations.length,
    }

    return response
  } catch (error) {
    // 清理导出目录
    try {
      await rm(exportPath, { recursive: true, force: true })
    } catch (e) {
      console.error('清理导出目录失败:', e)
    }
    throw error
  }
})
