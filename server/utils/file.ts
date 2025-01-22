import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * 从服务器文件系统加载文件
 */
export async function loadFile(path: string | undefined): Promise<Buffer> {
  if (!path) {
    throw new Error('File path is required')
  }

  try {
    // 确保路径是绝对路径
    const absolutePath = path.startsWith('/') ? path : resolve(process.cwd(), path)
    // 读取文件
    return await readFile(absolutePath)
  } catch (error) {
    console.error('Failed to load file:', error)
    throw error
  }
} 