import { copyFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function copyFFmpegFiles() {
  const sourceDir = join(__dirname, '../node_modules/@ffmpeg/core/dist/umd')
  const targetDir = join(__dirname, '../public/ffmpeg')

  try {
    // 创建目标目录
    await mkdir(targetDir, { recursive: true })

    // 复制文件
    await copyFile(
      join(sourceDir, 'ffmpeg-core.js'),
      join(targetDir, 'ffmpeg-core.js')
    )
    await copyFile(
      join(sourceDir, 'ffmpeg-core.wasm'),
      join(targetDir, 'ffmpeg-core.wasm')
    )

  } catch (error) {
    console.error('Failed to copy FFmpeg files:', error)
    process.exit(1)
  }
}

// 执行复制
copyFFmpegFiles() 