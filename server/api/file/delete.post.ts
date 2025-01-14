import { unlink } from 'fs/promises'
import { access } from 'fs/promises'

export default defineEventHandler(async (event) => {
  try {
    const { path } = await readBody(event)
    
    try {
      // 检查文件是否存在
      await access(path)
      // 删除文件
      await unlink(path)
    } catch (error: unknown) {
      // 如果文件不存在，返回成功
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return { success: true }
      }
      throw error
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting file:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 