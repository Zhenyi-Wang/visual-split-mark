export const uploader = {
  async saveFile(file: File, path: string, progressCallback?: (progress: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', path)

      // 监听上传进度
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && progressCallback) {
          const progress = event.loaded / event.total
          progressCallback(progress)
        }
      }

      // 监听请求完成
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }

      // 监听错误
      xhr.onerror = () => {
        reject(new Error('Upload failed'))
      }

      // 发送请求
      xhr.open('POST', '/api/file/save')
      xhr.send(formData)
    })
  }
} 