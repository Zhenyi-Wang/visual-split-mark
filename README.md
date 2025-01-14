# Visual Split Mark

一个简单的音频标注工具，用于音频文件的分割和标注。

## 功能特点

- 音频文件管理
  - 支持 MP3 格式音频上传
  - 服务器端转换为 WAV 格式
  - 分块上传大文件
  - 音频波形可视化

- 标注功能
  - 可视化标注界面
  - 支持拖拽选择区域
  - 支持 Whisper 自动识别文本
  - 支持手动编辑标注内容

- 数据管理
  - 项目管理
  - 数据导出

## 技术栈

- Nuxt 3 + TypeScript
- Naive UI 组件库
- Pinia 状态管理
- FFmpeg 音频处理（服务器端）
- Wavesurfer.js 波形显示

## 安装和使用

1. 安装依赖
```bash
yarn install
```

2. 开发模式运行
```bash
yarn dev
```

3. 构建生产版本
```bash
yarn build
```

## 数据管理

项目使用JSON文件存储数据，所有数据文件位于 `storage/data` 目录下：

- `projects.json`: 存储项目基本信息
- `audio_files.json`: 存储音频文件信息
- `annotations.json`: 存储标注数据
- `settings.json`: 存储应用设置

音频文件存储在以下目录：
- `storage/uploads`: 存储上传的原始音频文件
- `storage/converted`: 存储转换后的WAV文件

## 开发说明

- 开发文档位于 `docs/dev_docs` 目录
- 遵循 TypeScript 类型定义
- 使用 ESLint 和 Prettier 进行代码格式化

## 注意事项

1. 音频文件处理
   - 目前仅支持 MP3 格式输入
   - 服务器端自动转换为 16kHz 单声道 WAV 格式
   - 使用随机 ID 命名文件，避免冲突
   - 原始文件名保存在数据库中

2. 数据存储
   - 使用 JSON 文件存储项目数据
   - 定期备份以防数据丢失
   - 及时清理不需要的音频文件

## 未来计划

目前已经满足基本的音频标注需求。未来可能的改进方向包括：

1. 数据管理
   - 数据导入/导出功能
   - 数据压缩存储

2. 功能增强
   - 支持更多音频格式
   - 批量处理功能
   - 快捷键支持

## 许可证

MIT
