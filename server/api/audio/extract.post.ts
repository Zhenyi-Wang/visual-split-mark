import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  try {
    const { audioPath, start, end } = await readBody(event)
    const outputPath = join(process.cwd(), 'storage/temp', `${Date.now()}.wav`)
    
    // 使用 ffmpeg 提取音频片段
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', join(process.cwd(), audioPath),
        '-ss', start.toString(),
        '-t', (end - start).toString(),
        '-c', 'copy',
        outputPath
      ])

      let error = ''

      ffmpeg.stderr.on('data', (data) => {
        error += data.toString()
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(null)
        } else {
          reject(new Error(`FFmpeg failed: ${error}`))
        }
      })

      ffmpeg.on('error', (err) => {
        reject(err)
      })
    })

    // 读取生成的文件并返回
    const buffer = await readFile(outputPath)
    return buffer
  } catch (error) {
    console.error('Failed to extract audio segment:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to extract audio segment'
    })
  }
})