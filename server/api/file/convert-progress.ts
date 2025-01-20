import { EventEmitter } from 'events'

// 创建全局事件发射器用于跨请求通信
const progressEmitter = new EventEmitter()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const query = getQuery(event)
  const fileId = query.fileId as string

  if (!fileId) {
    throw createError({
      statusCode: 400,
      message: 'Missing fileId parameter'
    })
  }

  // 设置心跳以保持连接
  const heartbeat = setInterval(() => {
    event.node.res.write(':\n\n')
  }, 30000)

  // 监听进度更新
  const onProgress = (id: string, progress: number) => {
    if (id === fileId) {
      event.node.res.write(`data: ${JSON.stringify({ progress })}\n\n`)
    }
  }

  progressEmitter.on('progress', onProgress)

  // 清理函数
  const cleanup = () => {
    clearInterval(heartbeat)
    progressEmitter.off('progress', onProgress)
  }

  // 监听连接关闭
  event.node.req.on('close', cleanup)

  // 等待请求结束
  await new Promise((resolve) => {
    event.node.req.on('close', resolve)
  })
})

// 导出发射器供其他模块使用
export { progressEmitter } 