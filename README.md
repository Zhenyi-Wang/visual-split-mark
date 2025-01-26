# Visual Split Mark

[English](README_EN.md) | 简体中文

一个专门用于制作 Whisper 模型微调数据集的音频标注工具。通过直观的可视化界面，帮助用户快速准确地创建高质量的语音识别训练数据。

> **注意**: 这是一个个人项目，功能和稳定性可能有限。如果您没有处理长音频（1小时以上）的特殊需求，建议使用更成熟的开源方案 [Label Studio](https://github.com/HumanSignal/label-studio)。本项目的主要特点是支持在很长的原始音频上直接进行标注和动态分割，避免了预先分割音频的繁琐工作。而 Label Studio 更适合对已分割好的短音频进行标注。

## 项目说明

![界面预览](docs/assets/image.png)

本项目主要用于生成 [Whisper-Finetune](https://github.com/yeyupiaoling/Whisper-Finetune) 项目所需的微调数据集。为了提高标注效率，项目集成了 Whisper 转录功能，可以先通过 Whisper 进行初步转录，再进行人工校正。如果你需要一个简单的 Whisper API 服务，可以参考 [whisper-api](https://github.com/Zhenyi-Wang/whisper-api) 项目。

## 主要功能

### 音频可视化与标注
- 波形可视化显示
- 区域选择和时间调整
- 文本标注和编辑
- 支持 Whisper API 文本识别
- 自动保存标注数据

### 播放控制
- 空格键快捷播放/暂停
- 可调节播放速度（0.5x - 5x）
- 点击标注区域快速定位
- 波形缩放控制（像素/秒可调）

### 数据导出
- 符合 Whisper-Finetune 格式要求
- JSONL 格式数据文件
- 自动分割音频片段
- 导出进度实时显示

## 快速开始

### 安装
```bash
yarn install
```

### 运行
```bash
# 开发模式
yarn dev

# 构建部署
yarn build
```

### 配置 Whisper API
在项目设置中配置 Whisper API URL 以启用文本识别功能。推荐使用 [whisper-api](https://github.com/Zhenyi-Wang/whisper-api) 作为后端服务。

## 使用说明

### 标注流程
1. 创建项目并上传音频文件
2. 可选：使用 Whisper API 进行初步转录
3. 通过波形界面选择音频片段
4. 添加或编辑文本标注
5. 导出数据集

### 标注操作
- **区域选择**：在波形区域拖动鼠标
- **时间调整**：拖动区域边界
- **文本编辑**：点击标注区域右上角的编辑按钮
- **删除标注**：点击标注区域右上角的删除按钮

### 快捷键
- 空格键：播放/暂停
- 更多快捷键正在开发中...

## 数据格式

### 存储结构
- 项目数据：`storage/data/`
- 导出数据：`storage/exports/YYYYMMDD_HHmmss_项目名_音频文件名/`

### 导出格式
```
项目导出目录/
├── dataset/                # 音频片段目录
│   ├── uuid1.wav          # 音频片段文件
│   ├── uuid2.wav
│   └── ...
└── dataset.json           # 数据集描述文件（JSONL格式）
```

### dataset.json 格式
```jsonl
{"audio":{"path":"dataset/uuid1.wav"},"sentence":"标注文本","language":"Chinese","duration":2.34}
```

字段说明：
- `audio.path`: 音频文件相对路径
- `sentence`: 标注文本内容
- `language`: 文本语言（固定为 "Chinese"）
- `duration`: 音频片段时长（秒，保留 2 位小数）

## 开发计划

- [ ] 添加更多快捷键支持
- [ ] 优化音频处理性能
- [ ] 增加批量操作功能
- [ ] 支持更多音频格式

## 贡献

目前项目已完成基本功能，欢迎试用并提出改进建议。后续会根据实际使用情况持续优化。如果你有任何想法或建议，欢迎提出 Issue 或 Pull Request。
