import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import axios from 'axios'
import FormData from 'form-data'

export default defineEventHandler(async (event) => {
  try {
    const { audioPath, transcribeApiUrl, transcribeApiToken } = await readBody(event)

    if (!audioPath || !transcribeApiUrl) {
      throw createError({
        statusCode: 400,
        message: '缺少必要参数'
      })
    }

    const filePath = join(process.cwd(), audioPath)
    const fileBuffer = await readFile(filePath)

    const formData = new FormData()
    formData.append('file', fileBuffer, 'audio.wav')

    const headers: Record<string, string> = {
      ...formData.getHeaders(),
      'Accept': 'application/json'
    }

    if (transcribeApiToken) {
      headers['Authorization'] = `Bearer ${transcribeApiToken}`
    }

    const response = await axios.post(transcribeApiUrl, formData, {
      headers,
      timeout: 3600000,
      maxBodyLength: Infinity
    })

    return response.data
  } catch (error: any) {
    console.error('Transcribe service failed:', error.response?.data || error.message)
    throw createError({
      statusCode: error.response?.status || 500,
      message: error.response?.data?.message || error.response?.data?.detail || error.message || 'Transcription failed'
    })
  }
})
