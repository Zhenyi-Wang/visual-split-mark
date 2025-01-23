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
  event.node.res.write(`data: ${JSON.stringify({ progress: 0 })}\n\n`)
  
  // 进度更新处理函数
  const onProgress = (id: string, progress: number) => {
    if (id === exportId) {
      console.log('发送进度更新:', id, progress)
      event.node.res.write(`data: ${JSON.stringify({ progress })}\n\n`)
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