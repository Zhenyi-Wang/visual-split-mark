import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const backups = await storage.listBackups()
    return {
      success: true,
      backups
    }
  } catch (error) {
    console.error('Failed to list backups:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to list backups: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 