import { writeFile, mkdir, copyFile } from 'fs/promises'
import { dirname, join } from 'path'
import formidable from 'formidable'
import { storage } from '~/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const form = formidable({})
    const [fields, files] = await form.parse(event.node.req)
    
    if (!files.file?.[0] || !fields.projectId?.[0] || !fields.filename?.[0]) {
      throw createError({
        statusCode: 400,
        message: 'Missing file, projectId or filename'
      })
    }

    const file = files.file[0]
    const projectId = fields.projectId[0]
    const filename = fields.filename[0]
    
    // 获取项目目录中的文件路径
    const paths = storage.getAudioFilePaths(projectId, filename)
    const absolutePath = join(process.cwd(), paths.ORIGINAL)
    
    // 确保目录存在
    const dir = dirname(absolutePath)
    await mkdir(dir, { recursive: true })
    
    // 复制上传的临时文件到目标位置
    await copyFile(file.filepath, absolutePath)
    
    return {
      success: true,
      path: paths.ORIGINAL
    }
  } catch (error) {
    console.error('Error saving file:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to save file'
    })
  }
}) 