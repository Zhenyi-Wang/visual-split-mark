// 布局常量
export const PADDING = 20 // 内边距
export const TIME_AXIS_HEIGHT = 40 // 时间轴高度
export const WAVEFORM_HEIGHT = 200 // 波形区域高度
export const ANNOTATION_HEIGHT = 160 // 标注区域高度（增加高度）
export const TOTAL_HEIGHT = TIME_AXIS_HEIGHT + WAVEFORM_HEIGHT + ANNOTATION_HEIGHT // 总高度

// 旧的布局常量（过渡期保留）
export const TIME_AXIS_WIDTH = 50 // 时间轴宽度（已废弃）
export const WAVEFORM_WIDTH = 300 // 波形区域宽度（已废弃）

// 交互元素尺寸
export const HANDLE_SIZE = 4 // 拖拽手柄触发区域大小
export const HANDLE_VISUAL_SIZE = 6 // 拖拽手柄视觉大小
export const BUTTON_SIZE = 16 // 按钮尺寸（调小一点更合适横向布局）
export const BUTTON_PADDING = 8 // 按钮内边距
export const BUTTON_GAP = 5 // 按钮间距

// 缩放相关
export const MIN_PIXELS_PER_SECOND = 1 // 最小缩放比例
export const MAX_PIXELS_PER_SECOND = 500 // 最大缩放比例
export const DEFAULT_PIXELS_PER_SECOND = 50 // 默认缩放比例
export const INITIAL_VIEWPORT_WIDTH = 1000 // 初始视口宽度（像素）

// 播放速度
export const MIN_PLAYBACK_RATE = 0.5 // 最小播放速度
export const MAX_PLAYBACK_RATE = 5 // 最大播放速度
export const DEFAULT_PLAYBACK_RATE = 1 // 默认播放速度

// 颜色配置
export const COLORS = {
  waveform: '#4a9eff', // 波形颜色
  progress: '#ff4d4f', // 进度线颜色
  selection: {
    fill: 'rgba(74, 158, 255, 0.2)', // 选区填充色
    border: '#4a9eff', // 选区边框色
  },
  region: {
    fill: {
      normal: 'rgba(255, 182, 193, 0.2)', // 区域填充色
      hover: 'rgba(255, 182, 193, 0.3)', // 区域悬停填充色
      editing: 'rgba(255, 182, 193, 0.4)', // 区域编辑填充色
    },
    border: {
      normal: '#ffb6c1', // 区域边框色
      hover: '#ff69b4', // 区域悬停边框色
      editing: '#ff1493', // 区域编辑边框色
    },
  },
  button: {
    add: '#4a9eff', // 添加按钮颜色
    edit: '#4a9eff', // 编辑按钮颜色
    delete: '#ff4d4f', // 删除按钮颜色
  },
  text: {
    primary: '#333', // 主要文本颜色
    secondary: '#666', // 次要文本颜色
  },
  timeAxis: {
    background: '#f5f5f5', // 时间轴背景色
    line: {
      primary: '#999', // 主刻度线颜色
      secondary: '#d9d9d9', // 次刻度线颜色
    },
  },
} 