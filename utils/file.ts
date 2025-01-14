/**
 * 将 Blob 对象保存到指定路径
 */
export async function saveBlob(blob: Blob, path: string): Promise<void> {
  // 在浏览器环境中，我们使用 localStorage 来模拟文件系统
  // 实际项目中，这里应该调用后端 API 来保存文件
  const reader = new FileReader()
  
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      try {
        const base64 = reader.result as string
        localStorage.setItem(`file:${path}`, base64)
        resolve()
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * 从指定路径读取 Blob 对象
 */
export async function loadBlob(path: string): Promise<Blob | null> {
  // 从 localStorage 中读取文件
  const base64 = localStorage.getItem(`file:${path}`)
  if (!base64) return null

  // 将 base64 转换回 Blob
  const response = await fetch(base64)
  return response.blob()
}

/**
 * 从指定路径删除文件
 */
export async function deleteFile(path: string): Promise<void> {
  localStorage.removeItem(`file:${path}`)
}

/**
 * 生成文件的唯一路径
 */
export function generateFilePath(directory: string, filename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const ext = filename.split('.').pop()
  return `${directory}/${timestamp}-${random}.${ext}`
} 