import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { mkdir } from 'fs/promises'
import { progressEmitter } from './convert-progress'

// 解析 FFmpeg 时间字符串为秒
function parseTime(timeStr: string): number {
  const [hours, minutes, seconds] = timeStr.split(':').map(parseFloat)
  return hours * 3600 + minutes * 60 + seconds
}

export default defineEventHandler(async (event) => {
  try {
    const { inputPath, outputPath, fileId } = await readBody(event)
    
    // 确保输出路径是在 converted 目录下
    const absoluteInputPath = join(process.cwd(), inputPath)
    const absoluteOutputPath = join(process.cwd(), outputPath)
    
    // 确保输出目录存在
    const outputDir = dirname(absoluteOutputPath)
    await mkdir(outputDir, { recursive: true })

    // 获取音频总时长
    const duration = await new Promise<number>((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        absoluteInputPath
      ])

      let output = ''
      ffprobe.stdout.on('data', (data) => {
        output += data.toString()
      })

      ffprobe.on('close', (code) => {
        if (code === 0) {
          resolve(parseFloat(output.trim()))
        } else {
          reject(new Error('Failed to get duration'))
        }
      })
    })
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', absoluteInputPath,
        '-progress', 'pipe:1',
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        absoluteOutputPath
      ])

      ffmpeg.stdout.on('data', (data) => {
        const output = data.toString()
        const timeMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/)
        if (timeMatch) {
          const currentTime = parseTime(timeMatch[1])
          const progress = Math.min(99.9, (currentTime / duration) * 100)
          progressEmitter.emit('progress', fileId, progress)
        }
      })

      ffmpeg.stderr.on('data', (data) => {
        console.log('FFmpeg Error:', data.toString())
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // 发送 100% 进度
          progressEmitter.emit('progress', fileId, 100)
          resolve({ success: true })
        } else {
          reject(new Error('FFmpeg conversion failed'))
        }
      })

      ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err)
        reject(new Error('Failed to start FFmpeg'))
      })
    })
  } catch (error) {
    console.error('Error in conversion:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Conversion failed'
    })
  }
}) 