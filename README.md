# Visual Split Mark

一个用于音频标注的工具，支持波形可视化、区域选择和文本标注。

## 功能特点

- 音频波形可视化
- 区域选择和标注
- 文本识别（需配置 Whisper API）
- 标注导出
- 自动保存

## 标注操作

### 区域选择
- 在波形区域拖动鼠标进行选择
- 选择后可以点击添加按钮创建标注
- 可以通过拖动区域边界调整时间范围

### 标注编辑
- 鼠标悬停在标注区域时，右上角会显示编辑和删除按钮
- 点击编辑按钮可以修改标注文本
- 点击删除按钮可以删除标注
- 拖动标注区域的上下边界可以调整时间范围

### 播放控制
- 点击播放按钮或按空格键播放/暂停
- 可以调整播放速度（0.5x - 5x）
- 点击标注区域可以跳转到对应时间点

### 视图控制
- 使用缩放按钮调整波形显示比例
- 可以查看当前的像素/秒比例

## 快捷键

- 空格键：播放/暂停

## 开发

### 安装依赖

```bash
yarn install
```

### 开发服务器

```bash
yarn dev
```

### 构建

```bash
yarn build
```

## 配置

### Whisper API

在项目设置中配置 Whisper API URL 以启用文本识别功能。

## 数据存储

- 项目数据存储在 `storage/data` 目录下
- 包含项目信息、音频文件和标注数据
- 所有修改会自动保存

## 导出数据格式

导出的数据集位于 `storage/exports/YYYYMMDD_HHmmss_项目名_音频文件名/` 目录下，包含以下内容：

### 目录结构

```
storage/exports/YYYYMMDD_HHmmss_项目名_音频文件名/
├── dataset/                # 音频片段目录
│   ├── uuid1.wav          # 音频片段文件
│   ├── uuid2.wav
│   └── ...
└── dataset.json           # 数据集描述文件
```

### dataset.json 格式

dataset.json 采用 JSONL（JSON Lines）格式，每行是一个独立的 JSON 对象，描述一个音频片段：

```jsonl
{"audio":{"path":"dataset/uuid1.wav"},"sentence":"标注文本","language":"Chinese","duration":2.34}
{"audio":{"path":"dataset/uuid2.wav"},"sentence":"标注文本","language":"Chinese","duration":1.56}
```

每个 JSON 对象包含以下字段：
- `audio.path`: 音频文件的相对路径
- `sentence`: 标注的文本内容
- `language`: 文本语言（固定为 "Chinese"）
- `duration`: 音频片段时长（单位：秒，保留 2 位小数）
