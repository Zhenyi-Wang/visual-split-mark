import { progressEmitter } from '../../utils/progress'

export default defineEventHandler((event) => {
  const exportId = getQuery(event).id as string
  
  // 设置 SSE 头
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  
  // 进度更新处理函数
  const onProgress = (id: string, progress: number) => {
    if (id === exportId) {
      event.node.res.write(`data: ${JSON.stringify({ progress })}\n\n`)
    }
  }
  
  // 注册监听器
  progressEmitter.on('progress', onProgress)
  
  // 清理函数
  event.node.req.on('close', () => {
    progressEmitter.off('progress', onProgress)
  })
}) 