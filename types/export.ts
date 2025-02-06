import type { AudioFile, Annotation } from './project'

export interface ExportResponse {
  dirname: string
  path: string
  count: number
}

export interface ExportConfig {
  mergeSentences: boolean
  includeTimestamps: boolean
  mergeOnlyConsecutive: boolean  // 只合并连续标注
  maxDuration: number           // 最大合并时长（秒）
  maxGap: number               // 最大间隔时长（秒）
  keepGaps: boolean           // 是否保留间隔
}

export interface ExportRequest {
  exportId: string
  projectName: string
  audioFile: AudioFile
  annotations: Annotation[]
  config: ExportConfig
}

// 导出常量配置
export const EXPORT_CONSTANTS = {
  DEFAULT_CONFIG: {
    mergeSentences: false,
    includeTimestamps: true,     // 默认开启时间戳模式
    mergeOnlyConsecutive: true,  // 默认只合并连续标注
    maxDuration: 25,             // 默认最大时长 25 秒
    maxGap: 0.1,                // 默认最大间隔 0.1 秒
    keepGaps: false             // 默认不保留间隔
  } as ExportConfig
}

// 导出数据集条目接口
export interface DatasetEntry {
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

// 导出配置文件接口
export interface ExportConfigFile {
  version: string                // 导出格式版本
  exportTime: string            // 导出时间
  projectName: string           // 项目名称
  audioFile: {                  // 音频文件信息
    name: string
    duration: number
  }
  config: ExportConfig          // 导出配置
  stats: {                      // 导出统计
    totalAnnotations: number    // 原始标注数量
    exportedSegments: number    // 导出片段数量
    totalDuration: number       // 总时长（秒）
  }
} 