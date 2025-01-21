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
 * 从指定路径或 URL 加载 Blob 对象
 * @param source 可以是本地存储路径或 URL
 */
export async function loadBlob(source: string): Promise<Blob | null> {
  try {
    // 如果是 URL，直接从网络加载
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source)
      if (!response.ok) {
        throw new Error(`Failed to load blob: ${response.statusText}`)
      }
      return response.blob()
    }

    // 从服务器加载文件
    const response = await fetch(`/api/file/load?path=${encodeURIComponent(source)}`)
    if (!response.ok) {
      throw new Error(`Failed to load blob: ${response.statusText}`)
    }
    return response.blob()
  } catch (error) {
    console.error('Failed to load blob:', error)
    return null
  }
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

/**
 * 加载音频文件并显示进度
 * @param source 音频文件路径
 * @param onProgress 进度回调函数
 */
export async function loadAudioBlobWithProgress(
  source: string,
  onProgress: (phase: 'download' | 'decode', progress: number) => void
): Promise<{ blob: Blob, arrayBuffer: ArrayBuffer, audioBuffer: AudioBuffer }> {
  console.log('开始加载音频文件:', source)
  
  // 1. 下载文件并跟踪进度
  console.log('开始下载文件...')
  const response = await fetch(`/api/file/load?path=${encodeURIComponent(source)}`)
  if (!response.ok) {
    console.error('文件下载失败:', response.statusText)
    throw new Error(`Failed to load blob: ${response.statusText}`)
  }
  
  const contentLength = Number(response.headers.get('content-length'))
  if (contentLength) {
    console.log('文件总大小:', (contentLength / 1024 / 1024).toFixed(2), 'MB')
  } else {
    console.log('文件大小未知')
  }
  
  const reader = response.body!.getReader()
  const chunks: Uint8Array[] = []
  let receivedLength = 0
  
  // 读取数据流
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    chunks.push(value)
    receivedLength += value.length
    
    // 只有在知道总大小时才计算和报告百分比进度
    if (contentLength) {
      const progress = (receivedLength / contentLength) * 100
      await nextTick(() => onProgress('download', progress))
      console.log('下载进度:', progress.toFixed(1) + '%', 
        '已下载:', (receivedLength / 1024 / 1024).toFixed(2), 'MB')
    } else {
      // 否则只报告已下载的大小
      await nextTick(() => onProgress('download', 0))
      console.log('已下载:', (receivedLength / 1024 / 1024).toFixed(2), 'MB')
    }
  }
  
  console.log('文件下载完成')
  
  // 合并数据块
  const blob = new Blob(chunks)
  console.log('Blob 大小:', (blob.size / 1024 / 1024).toFixed(2), 'MB')
  
  // 2. 转换为 ArrayBuffer
  console.log('开始转换为 ArrayBuffer...')
  const arrayBuffer = await blob.arrayBuffer()
  console.log('ArrayBuffer 大小:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB')
  
  // 3. 解码音频
  console.log('开始解码音频...')
  const audioContext = new AudioContext()
  console.log('音频上下文采样率:', audioContext.sampleRate, 'Hz')
  
  // 使用分段解码来模拟进度
  const SEGMENTS = 10 // 将解码过程分为10段
  let decodedSegments = 0
  
  // 开始解码前报告进度
  await nextTick(() => onProgress('decode', 0))
  console.log('解码开始: 0%')
  
  // 使用 Promise 包装解码过程
  const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
    const startTime = performance.now()
    const decodeInterval = setInterval(async () => {
      decodedSegments++
      if (decodedSegments < SEGMENTS) {
        const progress = (decodedSegments / SEGMENTS) * 100
        await nextTick(() => onProgress('decode', progress))
        console.log('解码进度:', progress.toFixed(1) + '%',
          '已用时:', ((performance.now() - startTime) / 1000).toFixed(1), '秒')
      }
    }, 100)

    audioContext.decodeAudioData(
      arrayBuffer,
      async (decodedData) => {
        clearInterval(decodeInterval)
        const totalTime = (performance.now() - startTime) / 1000
        await nextTick(() => onProgress('decode', 100))
        console.log('解码完成: 100%', 
          '\n总用时:', totalTime.toFixed(1), '秒',
          '\n音频时长:', decodedData.duration.toFixed(1), '秒',
          '\n声道数:', decodedData.numberOfChannels,
          '\n采样率:', decodedData.sampleRate, 'Hz')
        resolve(decodedData)
      },
      (error) => {
        clearInterval(decodeInterval)
        console.error('解码失败:', error)
        reject(error)
      }
    )
  })

  console.log('音频加载完成')
  return { blob, arrayBuffer, audioBuffer }
}