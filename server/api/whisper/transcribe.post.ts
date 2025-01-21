import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import axios from 'axios'
import FormData from 'form-data'

export default defineEventHandler(async (event) => {
  try {
    const { audioPath, whisperApiUrl } = await readBody(event)
    
    if (!audioPath || !whisperApiUrl) {
      throw createError({
        statusCode: 400,
        message: '缺少必要参数'
      })
    }

    // 读取音频文件
    const filePath = join(process.cwd(), audioPath)
    const fileBuffer = await readFile(filePath)

    // 创建 FormData
    const formData = new FormData()
    formData.append('file', fileBuffer, 'audio.wav')

    // 调用 Whisper API，设置1小时超时
    const response = await axios.post(whisperApiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      },
      timeout: 3600000, // 1小时超时
      maxBodyLength: Infinity
    })

    return response.data
  } catch (error: any) {
    console.error('Whisper transcription failed:', error.response?.data || error.message)
    throw createError({
      statusCode: error.response?.status || 500,
      message: error.response?.data?.detail || error.message || 'Transcription failed'
    })
  }
}) 