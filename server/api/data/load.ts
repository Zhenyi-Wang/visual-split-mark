import { readFile } from 'fs/promises'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'storage/data/projects.json')

export default defineEventHandler(async () => {
  try {
    const data = await readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return {
        projects: [],
        audioFiles: [],
        annotations: [],
        settings: {},
        version: '1.0.0'
      }
    }
    throw createError({
      statusCode: 500,
      message: `Failed to load data: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 