import { writeFile, appendFile } from 'fs/promises'
import { dirname, join } from 'path'
import { mkdir } from 'fs/promises'

export default defineEventHandler(async (event) => {
  try {
    const { path: relativePath, data, isFirstChunk, isLastChunk } = await readBody(event)
    
    // 转换为绝对路径
    const absolutePath = join(process.cwd(), relativePath)
    console.log('Saving file chunk to path:', absolutePath, 'isFirst:', isFirstChunk, 'isLast:', isLastChunk)
    
    // 确保目录存在
    const dir = dirname(absolutePath)
    console.log('Creating directory:', dir)
    await mkdir(dir, { recursive: true })
    
    // 将 Uint8Array 数据写入文件
    console.log('Writing chunk, data length:', data.length)
    if (isFirstChunk) {
      // 第一个块，创建新文件
      await writeFile(absolutePath, Buffer.from(data))
    } else {
      // 后续块，追加到文件
      await appendFile(absolutePath, Buffer.from(data))
    }
    
    if (isLastChunk) {
      console.log('File saved successfully:', absolutePath)
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error saving file:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to save file: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 