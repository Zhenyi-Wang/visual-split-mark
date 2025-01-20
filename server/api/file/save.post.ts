import { writeFile, mkdir, copyFile } from 'fs/promises'
import { dirname, join } from 'path'
import formidable from 'formidable'

export default defineEventHandler(async (event) => {
  try {
    const form = formidable({})
    const [fields, files] = await form.parse(event.node.req)
    
    if (!files.file?.[0] || !fields.path?.[0]) {
      throw new Error('Missing file or path')
    }

    const file = files.file[0]
    const relativePath = fields.path[0]
    
    // 转换为绝对路径
    const absolutePath = join(process.cwd(), relativePath)
    console.log('Saving file to path:', absolutePath)
    
    // 确保目录存在
    const dir = dirname(absolutePath)
    console.log('Creating directory:', dir)
    await mkdir(dir, { recursive: true })
    
    // 复制上传的临时文件到目标位置
    await copyFile(file.filepath, absolutePath)
    
    return { success: true }
  } catch (error) {
    console.error('Error saving file:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to save file: ${error instanceof Error ? error.message : String(error)}`
    })
  }
}) 