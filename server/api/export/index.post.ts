import { mkdir, writeFile } from 'node:fs/promises'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { audioProcessor } from '~/utils/audio'
import type { AudioFile, Annotation } from '~/types/project'
import type { ExportResponse } from '~/types/export'
import { progressEmitter } from '../../utils/progress'
import { loadFile } from '../../utils/file'

export default defineEventHandler(async (event): Promise<ExportResponse> => {
  const { exportId, projectName, audioFile, annotations } = await readBody(event)
  
  // 使用传入的 exportId 作为目录名
  const dirname = exportId
  const exportPath = resolve(process.cwd(), 'storage/exports', dirname)
  const datasetPath = resolve(exportPath, 'dataset')

  try {
    // 创建导出目录
    await mkdir(datasetPath, { recursive: true })

    // 准备数据集
    const dataset = []
    const total = annotations.length

    // 处理每个标注
    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i]
      const uuid = crypto.randomUUID()
      
      console.log(`处理第 ${i + 1}/${total} 个标注:`, {
        start: annotation.start,
        end: annotation.end,
        text: annotation.text
      })
      
      // 提取音频片段
      const response = await $fetch<{ success: boolean, data: { path: string } }>('/api/audio/extract', {
        method: 'POST',
        body: {
          audioPath: audioFile.wavPath,
          start: annotation.start,
          end: annotation.end
        }
      })
      
      if (!response?.success || !response?.data?.path) {
        throw new Error('音频提取失败：未获取到输出文件路径')
      }
      
      console.log('音频片段已提取:', response.data.path)
      
      // 复制音频文件到目标目录
      const wavPath = resolve(datasetPath, `${uuid}.wav`)
      const wavBuffer = await loadFile(response.data.path)
      await writeFile(wavPath, wavBuffer)
      
      console.log('音频片段已保存:', wavPath)

      // 添加数据集条目
      dataset.push({
        audio: {
          path: `dataset/${uuid}.wav`
        },
        sentence: annotation.text,
        language: "Chinese",
        duration: Number((annotation.end - annotation.start).toFixed(2))
      })

      // 发送进度通知
      progressEmitter.emit('progress', dirname, Math.round((i + 1) / total * 100))
    }

    // 保存数据集 JSON 文件
    const jsonPath = resolve(exportPath, 'dataset.json')
    // 将每个数据条目转换为一行 JSON，并用换行符连接
    const jsonlContent = dataset.map(item => JSON.stringify(item)).join('\n')
    await writeFile(jsonPath, jsonlContent)
    console.log('数据集 JSONL 已保存:', jsonPath)

    const response: ExportResponse = {
      dirname,
      path: exportPath,
      count: annotations.length
    }

    return response

  } catch (error) {
    console.error('导出失败:', error)
    // 如果出错，尝试清理已创建的目录
    try {
      await rm(exportPath, { recursive: true, force: true })
      console.log('已清理导出目录:', exportPath)
    } catch (e) {
      console.error('清理导出目录失败:', e)
    }
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : '导出失败'
    })
  }
}) 