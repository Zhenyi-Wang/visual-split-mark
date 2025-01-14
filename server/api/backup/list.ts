import { readdir } from 'fs/promises'
import { join } from 'path'

const BACKUP_DIR = join(process.cwd(), 'storage/backups')

export default defineEventHandler(async () => {
  try {
    const files = await readdir(BACKUP_DIR)
    const backups = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse()
    
    return {
      success: true,
      backups
    }
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return {
        success: true,
        backups: []
      }
    }
    throw createError({
      statusCode: 500,
      message: `Failed to list backups: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 