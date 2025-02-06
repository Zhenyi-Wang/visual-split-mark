import { progressEmitter } from '../../utils/progress'

export default defineEventHandler((event) => {
  const exportId = getQuery(event).id as string
  
  if (!exportId) {
    throw createError({
      statusCode: 400,
      message: '缺少导出 ID'
    })
  }

  console.log('建立 SSE 连接:', exportId)
  
  // 设置 SSE 头
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  
  // 发送初始进度
  const initialData = JSON.stringify({ progress: 0 })
  console.log('发送初始进度:', initialData)
  event.node.res.write(`data: ${initialData}\n\n`)
  
  // 进度更新处理函数
  const onProgress = (id: string, progress: number) => {
    console.log('收到进度更新:', { id, progress, expectedId: exportId })
    if (id === exportId) {
      const data = JSON.stringify({ progress })
      console.log('发送进度更新:', data)
      event.node.res.write(`data: ${data}\n\n`)
      
      // 如果进度到达100%，关闭连接
      if (progress === 100) {
        console.log('导出完成，关闭连接')
        event.node.res.end()
      }
    }
  }
  
  // 注册监听器
  progressEmitter.on('progress', onProgress)
  
  // 清理函数
  event.node.req.on('close', () => {
    console.log('关闭 SSE 连接:', exportId)
    progressEmitter.off('progress', onProgress)
  })
}) 