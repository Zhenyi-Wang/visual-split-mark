import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineEventHandler(async (event) => {
  const { inputPaths, outputPath } = await readBody<{
    inputPaths: string[]  // 输入音频文件路径列表
    outputPath: string    // 输出音频文件路径
  }>(event)
  
  try {
    // 确保输出目录存在
    const outputDir = resolve(process.cwd(), outputPath).replace(/[^/]+$/, '')
    await mkdir(outputDir, { recursive: true })
    console.log('输出目录已创建:', outputDir)
    
    // 创建 FFmpeg concat 文件
    const concatFilePath = resolve(outputDir, 'concat.txt')
    const concatContent = inputPaths
      .map(path => `file '${resolve(process.cwd(), path)}'`)
      .join('\n')
    await writeFile(concatFilePath, concatContent)
    
    // 使用 FFmpeg 合并音频片段
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',           // 使用 concat 分离器
        '-safe', '0',             // 允许绝对路径
        '-i', concatFilePath,     // 输入文件列表
        '-acodec', 'pcm_s16le',   // 编码格式
        '-ar', '16000',           // 采样率
        '-ac', '1',               // 单声道
        outputPath
      ])

      let stderr = ''
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
        console.log(`FFmpeg: ${data}`)
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('FFmpeg 合并成功')
          resolve()
        } else {
          console.error('FFmpeg 合并失败:', stderr)
          reject(new Error(`FFmpeg process exited with code ${code}`))
        }
      })

      ffmpeg.on('error', (err) => {
        console.error('FFmpeg 进程错误:', err)
        reject(err)
      })
    })

    console.log('返回输出文件路径:', outputPath)
    
    return {
      success: true,
      data: {
        path: outputPath
      }
    }
    
  } catch (error) {
    console.error('音频合并失败:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : '音频合并失败'
    })
  }
}) 