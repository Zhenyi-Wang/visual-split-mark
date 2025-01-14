export const uploader = {
  async saveFile(file: File, path: string, progressCallback?: (progress: number) => void): Promise<void> {
    try {
      console.log('Saving file to:', path, 'size:', file.size, 'bytes')
      
      // 读取文件数据
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // 分块上传，每块 5MB
      const chunkSize = 5 * 1024 * 1024
      const totalChunks = Math.ceil(uint8Array.length / chunkSize)
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, uint8Array.length)
        const chunk = uint8Array.slice(start, end)
        
        await $fetch('/api/file/save', {
          method: 'POST',
          body: {
            path,
            data: Array.from(chunk),
            isFirstChunk: i === 0,
            isLastChunk: i === totalChunks - 1
          }
        })
        
        if (progressCallback) {
          progressCallback((i + 1) / totalChunks)
        }
      }
      
      console.log('File saved successfully')
    } catch (error) {
      console.error('Error saving file:', error)
      throw new Error(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
} 