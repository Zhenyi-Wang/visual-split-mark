import { readFile } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const { backupPath } = await readBody(event)
    const fullPath = join(process.cwd(), backupPath)
    
    // 读取备份文件
    const data = await readFile(fullPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 