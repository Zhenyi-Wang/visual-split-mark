import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

const BACKUP_DIR = join(process.cwd(), 'storage/backups')

export default defineEventHandler(async (event) => {
  try {
    const data = await readBody(event)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(BACKUP_DIR, `backup-${timestamp}.json`)
    
    // 确保备份目录存在
    await mkdir(dirname(backupPath), { recursive: true })
    
    // 写入备份文件
    await writeFile(backupPath, JSON.stringify({
      ...data,
      lastBackup: timestamp
    }, null, 2), 'utf-8')
    
    return {
      success: true,
      backupPath,
      timestamp
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 