import { readdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  try {
    // 导出目录路径
    const exportsPath = resolve(process.cwd(), 'storage/exports')
    
    // 读取导出目录
    const dirs = await readdir(exportsPath, { withFileTypes: true })
    
    // 过滤出目录并读取配置文件
    const exportItems = []
    
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const configPath = join(exportsPath, dir.name, 'config.json')
        
        // 检查配置文件是否存在
        if (existsSync(configPath)) {
          try {
            // 读取配置文件
            const configContent = await readFile(configPath, 'utf-8')
            const config = JSON.parse(configContent)
            
            // 添加到导出项列表
            exportItems.push({
              path: join(exportsPath, dir.name),
              dirname: dir.name,
              projectName: config.projectName || '未知项目',
              exportTime: config.exportTime || '未知时间',
              segments: config.stats?.exportedSegments || 0,
              duration: config.stats?.totalDuration || 0,
              selected: false,
              config
            })
          } catch (err) {
            console.error(`读取配置文件失败: ${configPath}`, err)
          }
        }
      }
    }
    
    // 按导出时间降序排序
    exportItems.sort((a, b) => {
      return new Date(b.exportTime).getTime() - new Date(a.exportTime).getTime()
    })
    
    return {
      exports: exportItems
    }
  } catch (error) {
    console.error('获取导出列表失败:', error)
    return {
      exports: []
    }
  }
})
