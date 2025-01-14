import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

const DATA_FILE = join(process.cwd(), 'storage/data/projects.json')

export default defineEventHandler(async (event) => {
  try {
    const data = await readBody(event)
    
    // 确保目录存在
    await mkdir(dirname(DATA_FILE), { recursive: true })
    
    // 写入数据
    await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    
    return { success: true }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to save data: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 