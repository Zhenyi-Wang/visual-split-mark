import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const { audioPath, start, end } = await readBody(event)
  
  try {
    // 创建临时目录
    const tempDir = resolve(process.cwd(), 'storage/temp')
    await mkdir(tempDir, { recursive: true })
    console.log('临时目录已创建:', tempDir)
    
    // 生成输出文件路径
    const outputPath = resolve(tempDir, `${randomUUID()}.wav`)
    
    // 确保输入音频路径是绝对路径
    const inputPath = resolve(process.cwd(), audioPath)
    console.log('音频提取参数:', {
      input: inputPath,
      output: outputPath,
      start,
      end
    })
    
    // 使用 FFmpeg 提取音频片段
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ss', start.toString(),
        '-to', end.toString(),
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        outputPath
      ])

      let stderr = ''
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
        console.log(`FFmpeg: ${data}`)
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('FFmpeg 执行成功')
          resolve()
        } else {
          console.error('FFmpeg 执行失败:', stderr)
          reject(new Error(`FFmpeg process exited with code ${code}`))
        }
      })

      ffmpeg.on('error', (err) => {
        console.error('FFmpeg 进程错误:', err)
        reject(err)
      })
    })

    console.log('返回输出文件路径:', outputPath)
    
    // 返回响应
    return {
      success: true,
      data: {
        path: outputPath
      }
    }
    
  } catch (error) {
    console.error('音频提取失败:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : '音频提取失败'
    })
  }
})