import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'

interface DatasetEntry {
  audio: {
    path: string
  }
  sentence: string
  language: string
  duration: number
  sentences?: {
    start: number
    end: number
    text: string
  }[]
}

export default defineEventHandler(async (event) => {
  try {
    // 获取请求体
    const body = await readBody(event)
    const { exports: exportPaths, outputDir } = body as { exports: string[], outputDir: string }

    if (!exportPaths || !Array.isArray(exportPaths) || exportPaths.length === 0) {
      return {
        success: false,
        error: '未选择导出项'
      }
    }

    // 创建输出目录
    const outputPath = resolve(process.cwd(), outputDir)
    if (!existsSync(outputPath)) {
      await mkdir(outputPath, { recursive: true })
    }

    // 处理每个导出项
    const allEntries: DatasetEntry[] = []
    
    for (const exportPath of exportPaths) {
      // 读取数据集文件
      const datasetPath = join(exportPath, 'dataset.json')
      if (!existsSync(datasetPath)) {
        console.warn(`数据集文件不存在: ${datasetPath}`)
        continue
      }

      // 读取数据集内容
      const datasetContent = await readFile(datasetPath, 'utf-8')
      const entries = datasetContent.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))

      // 添加到总集合
      allEntries.push(...entries)
    }

    // 打乱数据集
    shuffleArray(allEntries)

    // 分割为训练集和测试集
    const splitIndex = Math.floor(allEntries.length * 0.9)
    const trainEntries = allEntries.slice(0, splitIndex)
    const testEntries = allEntries.slice(splitIndex)

    console.log(`总条目数: ${allEntries.length}, 训练集: ${trainEntries.length}, 测试集: ${testEntries.length}`)

    // 复制音频文件并更新路径
    const processedTrain = await processEntries(trainEntries, exportPaths, outputPath)
    const processedTest = await processEntries(testEntries, exportPaths, outputPath)

    // 保存训练集和测试集
    await writeFile(
      join(outputPath, 'train.json'),
      processedTrain.map(entry => JSON.stringify(entry)).join('\n')
    )

    await writeFile(
      join(outputPath, 'test.json'),
      processedTest.map(entry => JSON.stringify(entry)).join('\n')
    )

    return {
      success: true,
      outputPath,
      stats: {
        total: allEntries.length,
        train: trainEntries.length,
        test: testEntries.length
      }
    }
  } catch (error) {
    console.error('处理导出失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

// 打乱数组
function shuffleArray(array: any[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

// 处理数据集条目
async function processEntries(entries: DatasetEntry[], exportPaths: string[], outputPath: string): Promise<DatasetEntry[]> {
  const processed: DatasetEntry[] = []

  for (const entry of entries) {
    try {
      // 找到音频文件所在的导出目录
      const audioRelativePath = entry.audio.path
      let sourceAudioPath = null

      for (const exportPath of exportPaths) {
        const potentialPath = join(exportPath, audioRelativePath)
        if (existsSync(potentialPath)) {
          sourceAudioPath = potentialPath
          break
        }
      }

      if (!sourceAudioPath) {
        console.warn(`找不到音频文件: ${audioRelativePath}`)
        continue
      }

      // 获取文件名并复制到输出目录
      const audioFilename = basename(sourceAudioPath)
      const targetAudioPath = join(outputPath, audioFilename)
      
      await copyFile(sourceAudioPath, targetAudioPath)

      // 创建新的条目，更新音频路径
      const newEntry = { ...entry }
      newEntry.audio = { path: `dataset/${audioFilename}` }
      
      processed.push(newEntry)
    } catch (err) {
      console.error(`处理条目失败:`, err)
    }
  }

  return processed
}
