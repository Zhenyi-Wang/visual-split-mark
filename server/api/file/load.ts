import { createReadStream } from 'fs'
import { join } from 'path'
import { access } from 'fs/promises'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const path = query.path as string

    if (!path) {
      throw createError({
        statusCode: 400,
        message: 'Path parameter is required'
      })
    }

    // 转换为绝对路径
    const absolutePath = join(process.cwd(), path)

    // 检查文件是否存在
    try {
      await access(absolutePath)
    } catch {
      throw createError({
        statusCode: 404,
        message: 'File not found'
      })
    }

    // 设置响应头
    setHeaders(event, {
      'Content-Type': 'application/octet-stream'
    })

    // 返回文件流
    return sendStream(event, createReadStream(absolutePath))
  } catch (error) {
    console.error('Error loading file:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 