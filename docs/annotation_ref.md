# 音频标注页面参考文档

本文档详细描述了音频标注页面（pages/annotation/[id].vue）的实现细节，包括其依赖、组件结构、状态管理和核心功能。

## 目录
1. [变量和类型](#1-变量和类型)
2. [组件依赖](#2-组件依赖)
3. [状态管理](#3-状态管理)
4. [核心功能实现](#4-核心功能实现)
5. [生命周期钩子](#5-生命周期钩子)
6. [架构设计](#6-架构设计)
7. [性能优化](#7-性能优化)
8. [最佳实践](#8-最佳实践)

## 1. 变量和类型

### 1.1 导入的变量和类型
- format (from date-fns): 用于格式化日期时间
- useMessage (from naive-ui): 用于显示消息提示
- FormInst, FormRules (from naive-ui): 表单实例和验证规则类型
- ComponentPublicInstance (from vue): Vue 组件实例类型
- Annotation, AudioFile (from ~/types/project): 
  ```typescript
  interface Annotation {
    id: string
    audioFileId: string
    start: number
    end: number
    text: string
    whisperText?: string
    createdAt: Date
    updatedAt: Date
  }

  interface AudioFile {
    id: string
    projectId: string
    originalName: string
    originalPath: string
    wavPath: string
    duration: number
    status: 'uploaded' | 'converting' | 'ready' | 'error'
    createdAt: Date
    updatedAt: Date
  }
  ```
- WhisperResult (from ~/utils/whisper): 语音识别结果类型
- storage (from ~/utils/storage): 数据持久化功能
- useAudioVisualizer (from ~/composables/useAudioVisualizer): 音频可视化组件的核心功能
- useAudioPlayer, LoadingPhase (from ~/composables/useAudioPlayer): 音频播放器功能
- useWhisper (from ~/composables/useWhisper): 语音识别功能
- Icons (from @vicons/ionicons5):
  - AddCircleOutline as IconZoomIn
  - RemoveCircleOutline as IconZoomOut
  - AddOutline as IconAdd
  - RemoveOutline as IconRemove
- useViewportStore (from ~/stores/viewport): 视图状态管理
- MessageReactive (from naive-ui): 消息组件类型
- NSpin (from naive-ui): 加载动画组件
- unref, toRef, toRefs (from vue): Vue 响应式 API
- storeToRefs (from pinia): Pinia 状态管理工具
- useExport (from ~/composables/useExport): 导出功能

### 1.2 本地定义的变量
1. 工具函数：
   - formatDuration: 格式化音频时长（秒数）为 MM:SS 格式
   - formatTimestamp: 使用 date-fns 格式化时间戳

2. 路由和状态管理：
   - route: Vue Router 实例
   - router: Vue Router 实例
   - projectStore: Pinia 项目状态管理
   - message: Naive UI 消息提示
   - viewport: 视图状态管理

3. 音频处理相关：
   - transcribe: 语音识别功能
   - transcribing: 语音识别状态
   - exporting: 导出状态
   - currentProject: 当前项目信息
   - isPlaying: 音频播放状态
   - duration: 音频总时长
   - currentTime: 当前播放时间
   - pixelsPerSecond: 波形图像素/秒比例
   - selectedRegion: 当前选中的区域
   - editingAnnotation: 正在编辑的标注
   - clearEditingAnnotation: 清除编辑状态
   - initialize: 初始化音频播放器和可视化
   - destroy: 清理资源
   - playPause: 播放/暂停控制
   - seek: 跳转到指定时间
   - zoomIn/zoomOut: 缩放控制
   - playbackRate: 播放速率
   - setPlaybackRate: 设置播放速率

4. 标注管理：
   - addRegion: 添加标注区域
   - updateRegion: 更新标注区域
   - removeRegion: 删除标注区域
   - clearRegions: 清除所有标注
   - onAddButtonClick: 添加按钮点击处理
   - onEditButtonClick: 编辑按钮点击处理
   - onDeleteButtonClick: 删除按钮点击处理
   - updateDrawing: 更新波形绘制

5. 加载状态：
   - loadingPhase: 加载阶段
   - loadingProgress: 加载进度

## 2. 组件依赖

### 2.1 Naive UI 组件
- n-space: 布局组件，用于管理子元素间距
- n-page-header: 页面头部组件，包含返回按钮和标题
- n-button: 按钮组件，用于各种操作
- n-icon: 图标组件
- n-text: 文本组件
- n-divider: 分割线组件
- n-button-group: 按钮组组件
- n-input-number: 数字输入组件
- n-modal: 模态框组件
- n-spin: 加载动画组件
- n-input: 文本输入组件

### 2.2 组件交互
1. 页面布局：
   - 顶部：页面标题、操作按钮（识别文本、导出数据集）
   - 工具栏：播放控制、时间显示、倍速控制、缩放控制、视口控制
   - 主内容：音频标注器

2. 模态框：
   - 加载状态模态框：显示音频加载进度
   - 删除确认模态框：确认删除标注
   - 标注文本输入模态框：输入/编辑标注文本
   - 导出模态框：显示导出进度和结果

## 3. 状态管理

### 3.1 Pinia Store
1. projectStore (~/stores/project.ts):
   - 状态：
     - projects: 项目列表
     - audioFiles: 音频文件列表
     - annotations: 标注列表
     - currentProject: 当前选中的项目
     - currentAudioFile: 当前选中的音频文件
     - loading: 加载状态
     - error: 错误信息
   - Getters：
     - projectAudioFiles: 当前项目的音频文件列表
     - audioFileAnnotations: 当前音频文件的标注列表
   - Actions：
     - initialize: 初始化数据
     - saveAll: 保存所有数据
     - setCurrentProject: 设置当前项目
     - setCurrentAudioFile: 设置当前音频文件
     - createProject: 创建项目
     - updateProject: 更新项目
     - deleteProject: 删除项目
     - addAudioFile: 添加音频文件
     - updateAudioFile: 更新音频文件
     - deleteAudioFile: 删除音频文件
     - updateAnnotation: 更新标注
     - deleteAnnotation: 删除标注
     - updateAnnotations: 批量更新标注

### 3.2 Viewport Store
1. viewport (~/stores/viewport.ts):
   - 状态：
     - startTime: 视口起始时间
     - endTime: 视口结束时间
     - duration: 音频总时长
   - Getters：
     - viewDuration: 视口时长
   - Actions：
     - setDuration: 设置总时长并初始化视口
     - setViewport: 设置视口范围
     - isTimeInViewport: 检查时间点是否在视口范围内
     - getTimePosition: 获取时间点在视口中的位置

### 3.3 状态持久化
1. storage (~/utils/storage.ts):
   - 存储路径：
     - DATA: storage/data
     - UPLOADS: storage/uploads
     - CONVERTED: storage/converted
   - 数据文件：
     - PROJECTS: projects.json
     - AUDIO_FILES: audio_files.json
     - ANNOTATIONS: annotations.json
     - SETTINGS: settings.json
   - 方法：
     - saveData: 保存数据到文件
     - loadData: 从文件加载数据

## 4. 核心功能实现

### 4.1 音频可视化系统（useAudioVisualizer）
1. 核心依赖：
   - useAudioPlayer: 音频播放控制
   - useWaveformDrawer: 波形绘制
   - useInteractionHandler: 交互处理
   - useRegionManager: 区域管理
   - useViewportStore: 视口状态管理

2. 关键状态：
   - editingAnnotation: 当前编辑中的标注
   - selectedRegion: 当前选中的区域
   - pixelsPerSecond: 波形图缩放比例
   - animationFrame: 动画帧引用
   - isDrawingRequested: 绘制请求状态
   - addButtonBounds/editButtonBounds/deleteButtonBounds: 按钮区域信息

3. 初始化流程（initialize）：
   1. 初始化音频播放器并获取音频数据
   2. 初始化波形绘制器
   3. 设置视口持续时间（默认显示前30秒）
   4. 设置音频数据到波形绘制器
   5. 设置回调函数
   6. 添加事件监听：
      - timeupdate: 更新播放位置和滚动
      - resize: 调整画布大小
      - mousedown/mousemove/mouseup/mouseleave: 处理交互

4. 事件处理机制：
   1. 音频播放事件：
      - 更新播放位置
      - 自动滚动到当前位置
      - 清除选区
      - 更新绘制
   
   2. 鼠标事件：
      - mousedown: 处理点击开始，记录时间
      - mousemove: 处理拖动、悬停和选区
      - mouseup: 处理拖动结束，触发保存
      - mouseleave: 处理鼠标离开

5. 绘制更新机制：
   - 使用 requestAnimationFrame 优化性能
   - 防止重复绘制请求
   - 同步更新选区状态
   - 处理标注变更和按钮状态

### 4.2 波形绘制器（useWaveformDrawer）
1. 核心状态：
   - canvas: Canvas 元素引用
   - canvasCtx: Canvas 2D 上下文
   - channelData: 音频数据
   - container: 容器元素引用
   - isLoading: 加载状态
   - waveformCache: 波形数据缓存

2. 布局常量：
   - PADDING: 内边距
   - TIME_AXIS_HEIGHT: 时间轴高度
   - WAVEFORM_HEIGHT: 波形区域高度
   - ANNOTATION_HEIGHT: 标注区域高度
   - BUTTON_SIZE/PADDING/GAP: 按钮相关尺寸

3. 绘制功能：
   1. 波形绘制（drawWaveform）：
      - 计算可见范围和尺寸
      - 绘制背景和分隔线
      - 使用缓存优化波形数据计算
      - 绘制波形条形图
      - 绘制进度线

   2. 时间轴绘制（drawTimeAxis）：
      - 计算时间刻度
      - 绘制刻度线和时间标签
      - 自适应时间格式

   3. 区域绘制（drawRegions）：
      - 绘制标注区域背景
      - 绘制区域边界和手柄
      - 处理悬停和编辑状态
      - 绘制操作按钮

   4. 选区绘制（drawSelection）：
      - 绘制选区背景
      - 绘制选区边界
      - 绘制添加按钮

4. 性能优化：
   - 使用波形数据缓存
   - 优化采样点计算
   - 使用 subarray 优化内存访问
   - 避免不必要的重绘

5. 交互元素：
   1. 按钮绘制：
      - drawButton: 绘制圆形按钮基础
      - drawEditIcon: 绘制编辑图标
      - drawDeleteIcon: 绘制删除图标
      - drawAddIcon: 绘制添加图标

   2. 坐标转换：
      - useCoordinateTransform: 处理时间和像素坐标转换
      - 支持缩放和平移

### 4.3 坐标转换器（useCoordinateTransform）
1. 配置接口：
   ```typescript
   interface CoordinateTransformConfig {
     startTime: Ref<number>    // 视口起始时间
     endTime: Ref<number>      // 视口结束时间
     width: Ref<number>        // 画布宽度
   }
   ```

2. 核心计算：
   - pixelsPerSecond: 计算每秒对应的像素数
     ```typescript
     const pixelsPerSecond = computed(() => {
       const duration = config.endTime.value - config.startTime.value
       return config.width.value / duration
     })
     ```

3. 转换函数：
   1. 坐标到时间（getTimeFromX）：
      - 输入：x 坐标（像素）
      - 输出：对应的时间点
      - 计算：startTime + (x / pixelsPerSecond)

   2. 时间到坐标（getXFromTime）：
      - 输入：时间点
      - 输出：对应的 x 坐标
      - 计算：(time - startTime) * pixelsPerSecond

   3. 可见性检查（isTimeVisible）：
      - 输入：时间点
      - 输出：是否在可视区域内
      - 检查：time >= startTime && time <= endTime

4. 特点：
   - 响应式计算：使用 Vue 的 computed 属性
   - 双向转换：支持时间和坐标的互相转换
   - 视口感知：考虑当前视口范围
   - 高精度：使用浮点数计算保证精确性

5. 使用场景：
   1. 波形绘制：
      - 计算音频采样点的显示位置
      - 确定时间刻度的位置

   2. 交互处理：
      - 转换鼠标点击位置到时间点
      - 计算拖动距离对应的时间变化

   3. 视口管理：
      - 计算可见区域的时间范围
      - 处理缩放和平移操作

### 4.4 区域管理器（useRegionManager）
1. 核心状态：
   - regions: 使用 Map 存储的区域集合，key 为区域 ID

2. 基础操作：
   - addRegion: 添加新区域
   - updateRegion: 更新现有区域
   - removeRegion: 删除区域
   - clearRegions: 清空所有区域
   - getRegion: 获取单个区域
   - getAllRegions: 获取所有区域
   - hasRegion: 检查区域是否存在
   - getRegionCount: 获取区域数量

3. 高级查询：
   1. 时间查询：
      - findRegionByTime: 查找包含指定时间点的区域
      - findOverlappingRegions: 查找与时间范围重叠的区域
      - hasOverlappingRegions: 检查是否存在重叠区域

   2. 区域操作：
      - mergeOverlappingRegions: 合并重叠区域
        - 计算合并后的起止时间
        - 合并文本内容
        - 删除原始区域
      - splitRegion: 分割区域
        - 在指定时间点分割
        - 创建两个新区域
        - 保持原始文本

4. 数据结构（Region 类型）：
   ```typescript
   interface Region {
     start: number      // 开始时间
     end: number        // 结束时间
     text: string       // 标注文本
   }
   ```

5. 特点：
   - 使用 Map 结构保证高效的增删改查
   - 支持复杂的时间范围查询
   - 提供区域合并和分割功能
   - 保证数据一致性

### 4.5 音频播放器（useAudioPlayer）
1. 核心状态：
   ```typescript
   // Web Audio API 相关
   const audioContext = ref<AudioContext | null>(null)
   const audioElement = ref<HTMLAudioElement | null>(null)
   const channelData: Float32Array | null = null

   // 播放控制相关
   const isPlaying = ref(false)
   const duration = ref(0)
   const currentTime = ref(0)
   const playbackRate = ref(1)

   // 加载状态
   const loadingPhase = ref<LoadingPhase>('idle')
   const loadingProgress = ref(0)
   ```

2. 加载阶段（LoadingPhase）：
   ```typescript
   type LoadingPhase = 'idle' | 'downloading' | 'decoding' | 'ready'
   ```
   - idle: 初始状态或销毁后的状态
   - downloading: 正在下载音频文件
   - decoding: 正在解码音频数据
   - ready: 准备就绪可以播放

3. 初始化流程（initialize）：
   1. 重置加载状态
   2. 创建音频元素
   3. 加载并解码音频文件
      - 使用 loadAudioBlobWithProgress 加载
      - 实时更新加载进度
   4. 创建音频上下文
   5. 设置音频数据
      - 设置持续时间
      - 获取声道数据
   6. 创建音频源并连接
   7. 添加事件监听
      - play: 更新播放状态
      - pause: 更新暂停状态
      - timeupdate: 更新当前时间

4. 播放控制：
   1. playPause：播放/暂停切换
      - 检查并恢复音频上下文
      - 切换播放状态
      - 处理异步播放

   2. seek：跳转到指定时间
      - 边界检查
      - 设置当前时间

   3. setPlaybackRate：设置播放速率
      - 更新速率状态
      - 应用到音频元素

5. 资源清理（destroy）：
   - 关闭音频上下文
   - 停止音频播放
   - 清除音频源
   - 重置所有状态

6. 特点：
   - 使用 Web Audio API 实现高精度控制
   - 支持进度监控和状态管理
   - 提供完整的生命周期管理
   - 异步加载和错误处理

### 4.6 语音识别（useWhisper）
1. 依赖：
   ```typescript
   import { useMessage } from 'naive-ui'
   import { transcribeAudio, type WhisperResult } from '~/utils/whisper'
   import type { Project, AudioFile, Annotation } from '~/types/project'
   ```

2. 核心功能（transcribe）：
   1. 前置检查：
      - 检查当前项目是否存在
      - 检查 Whisper API URL 是否配置

   2. 识别流程：
      - 调用 Whisper API 进行识别
      - 将识别结果转换为标注格式
      - 批量保存标注

   3. 标注转换：
   ```typescript
   const annotations: Annotation[] = result.segments.map(segment => ({
     id: crypto.randomUUID(),
     audioFileId: audioFile.id,
     start: segment.start,
     end: segment.end,
     text: segment.text.trim(),
     whisperText: segment.text.trim(),
     createdAt: new Date(),
     updatedAt: new Date()
   }))
   ```

3. 错误处理：
   - 项目未选择错误
   - API URL 未配置错误
   - 网络请求错误
   - 识别失败错误

4. 特点：
   - 自动生成标注 ID
   - 保留原始识别文本
   - 支持批量处理
   - 自动时间戳对齐

5. 使用场景：
   1. 批量识别：
      - 处理长音频文件
      - 自动分段标注

   2. 辅助标注：
      - 提供初始文本
      - 支持人工修正

### 4.7 导出功能（useExport）
1. 核心状态：
   ```typescript
   const progress = ref(0)
   const status = ref<'idle' | 'exporting' | 'completed' | 'failed'>('idle')
   ```

2. 状态定义：
   - idle: 初始状态或重置状态
   - exporting: 正在导出
   - completed: 导出完成
   - failed: 导出失败

3. 导出流程（exportAnnotations）：
   1. 前置检查：
      - 检查音频文件是否存在
      - 过滤获取相关标注
      - 检查标注是否为空

   2. 导出过程：
   ```typescript
   const result = await exportManager.exportFile(
     projectName,
     audioFile,
     annotations,
     (value) => {
       progress.value = value
     }
   )
   ```

   3. 状态管理：
      - 开始时设置为 exporting
      - 完成时设置为 completed
      - 失败时设置为 failed
      - 实时更新进度

4. 错误处理：
   - 音频文件不存在错误
   - 标注数据为空错误
   - 导出过程错误
   - 提供错误消息提示

5. 特点：
   - 支持进度监控
   - 状态管理完善
   - 错误处理全面
   - 用户友好的提示

6. 使用场景：
   1. 数据导出：
      - 导出标注数据
      - 导出音频片段

   2. 进度展示：
      - 实时进度更新
      - 状态反馈
      - 错误提示

## 5. 生命周期钩子

### 5.1 onMounted
1. 初始化流程：
   1. 初始化项目存储
   2. 检查音频文件是否存在
   3. 设置当前音频文件
   4. 检查并设置当前项目
   5. 初始化音频播放器
   6. 设置波形数据
   7. 设置视口范围
   8. 加载已有标注
   9. 设置按钮回调
   10. 添加键盘事件监听
   11. 触发 resize 事件

2. 错误处理：
   - 音频文件不存在时跳转到首页
   - 项目不存在时跳转到首页
   - 音频加载失败时显示错误提示

3. 延迟处理：
   - 延迟显示图标以确保 DOM 完全加载

### 5.2 onUnmounted
1. 清理流程：
   - 销毁音频播放器
   - 移除键盘事件监听

### 5.3 watch 监听器
1. showTextInputModal：
   - 监听文本输入框显示状态
   - 关闭时清理未保存的标注

2. projectStore.audioFileAnnotations：
   - 监听标注列表变化
   - 清除并重新添加所有标注区域

3. showExportModal：
   - 监听导出模态框显示状态
   - 显示时自动开始导出
   - 处理导出错误

### 5.4 computed 计算属性
1. loadingDescription：
   - 根据加载阶段和进度计算描述文本

2. isLoading：
   - 根据加载阶段和初始化状态计算加载状态

3. viewportStartPercent/viewportEndPercent：
   - 计算和设置视口范围百分比

4. maxStartPercent/minEndPercent：
   - 计算视口范围的限制值

## 6. 架构设计

### 6.1 分层架构
1. 表现层：
   - pages/annotation/[id].vue：页面组件
   - 负责用户界面和交互
   - 协调各个功能模块

2. 业务逻辑层：
   - useAudioVisualizer：音频可视化核心
   - useRegionManager：区域管理
   - useWhisper：语音识别
   - useExport：导出功能

3. 数据访问层：
   - projectStore：项目数据管理
   - viewportStore：视图状态管理
   - storage：数据持久化

4. 基础设施层：
   - useAudioPlayer：音频播放控制
   - useWaveformDrawer：波形绘制
   - useCoordinateTransform：坐标转换

### 6.2 模块依赖关系
1. 核心依赖：
   ```
   [id].vue
   ├── useAudioVisualizer
   │   ├── useAudioPlayer
   │   ├── useWaveformDrawer
   │   ├── useRegionManager
   │   └── useCoordinateTransform
   ├── useWhisper
   ├── useExport
   ├── projectStore
   └── viewportStore
   ```

2. 数据流：
   - 单向数据流
   - 状态提升
   - 事件下发

3. 通信机制：
   - Props/Events
   - Pinia Store
   - 发布/订阅

### 6.3 扩展性设计
1. 插件机制：
   - 音频处理插件
   - 导出格式插件
   - 识别服务插件

2. 配置化：
   - 界面布局
   - 快捷键
   - API 设置

3. 接口抽象：
   - 标准化的数据接口
   - 统一的事件接口
   - 插件接口规范

## 7. 性能优化

### 7.1 渲染优化
1. Canvas 优化：
   - 分层绘制
   - 局部更新
   - 缓存机制
   - 异步绘制

2. DOM 优化：
   - 虚拟列表
   - 延迟加载
   - 防抖/节流

3. 计算优化：
   - Web Worker
   - 缓存计算结果
   - 增量更新

### 7.2 资源优化
1. 音频处理：
   - 流式加载
   - 分段解码
   - 内存管理

2. 数据处理：
   - 批量操作
   - 增量同步
   - 懒加载

3. 网络优化：
   - 数据压缩
   - 断点续传
   - 请求合并

### 7.3 用户体验优化
1. 响应优化：
   - 即时反馈
   - 进度提示
   - 状态同步

2. 交互优化：
   - 快捷键支持
   - 拖放操作
   - 上下文菜单

3. 错误处理：
   - 优雅降级
   - 自动恢复
   - 友好提示

## 8. 最佳实践

### 8.1 代码组织
1. 目录结构：
   ```
   pages/
   ├── annotation/
   │   └── [id].vue
   composables/
   ├── useAudioVisualizer.ts
   ├── useAudioPlayer.ts
   ├── useWaveformDrawer.ts
   ├── useRegionManager.ts
   ├── useCoordinateTransform.ts
   ├── useWhisper.ts
   └── useExport.ts
   stores/
   ├── project.ts
   └── viewport.ts
   utils/
   ├── audio.ts
   ├── storage.ts
   └── whisper.ts
   ```

2. 命名规范：
   - 组件：PascalCase
   - 组合式函数：camelCase，use 前缀
   - 工具函数：camelCase
   - 常量：UPPER_CASE

3. 文件组织：
   - 单一职责
   - 关注点分离
   - 高内聚低耦合

### 8.2 开发规范
1. 类型安全：
   - TypeScript 类型定义
   - 类型检查
   - 类型推导

2. 错误处理：
   - 异常捕获
   - 错误边界
   - 日志记录

3. 测试策略：
   - 单元测试
   - 集成测试
   - E2E 测试

### 8.3 维护建议
1. 文档维护：
   - 及时更新
   - 版本对应
   - 示例完整

2. 代码维护：
   - 定期重构
   - 性能监控
   - 依赖更新

3. 功能迭代：
   - 向后兼容
   - 渐进增强
   - 特性开关
``` 