import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { mkdir } from 'fs/promises'

export default defineEventHandler(async (event) => {
  try {
    const { inputPath, outputPath } = await readBody(event)
    
    // 确保输出路径是在 converted 目录下
    const absoluteInputPath = join(process.cwd(), inputPath)
    const absoluteOutputPath = join(process.cwd(), outputPath.replace('storage/uploads', 'storage/converted'))
    
    // 确保输出目录存在
    const outputDir = dirname(absoluteOutputPath)
    await mkdir(outputDir, { recursive: true })
    
    console.log('Converting file:', {
      input: absoluteInputPath,
      output: absoluteOutputPath
    })
    
    return new Promise((resolve, reject) => {
      // 使用 ffmpeg 命令行工具进行转换
      const ffmpeg = spawn('ffmpeg', [
        '-i', absoluteInputPath,
        '-ar', '16000',  // 采样率
        '-ac', '1',      // 单声道
        '-c:a', 'pcm_s16le',  // 16位 PCM
        absoluteOutputPath
      ])

      let error = ''

      ffmpeg.stderr.on('data', (data) => {
        const message = data.toString()
        console.log('FFmpeg:', message)
        error += message
      })

      ffmpeg.stdout.on('data', (data) => {
        console.log('FFmpeg output:', data.toString())
      })

      ffmpeg.on('close', (code) => {
        console.log('FFmpeg process exited with code:', code)
        if (code === 0) {
          resolve({ success: true })
        } else {
          reject(new Error(`FFmpeg conversion failed: ${error}`))
        }
      })

      ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err)
        reject(new Error(`Failed to start FFmpeg: ${err.message}`))
      })
    })
  } catch (error) {
    console.error('Error converting file:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to convert file: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 