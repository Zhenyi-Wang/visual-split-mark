import { ref, watch } from 'vue'

export interface AudioViewState {
  currentTime: number
  scrollPosition: number
  startTime: number
  endTime: number
  pixelsPerSecond: number
}

const STORAGE_KEY = 'audio_view_states'

// 检查是否在客户端
const isClient = typeof window !== 'undefined'

export function useViewState(audioId: string) {
  // 从 localStorage 加载所有状态
  const loadStates = (): Record<string, AudioViewState> => {
    if (!isClient) return {}
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  }

  // 保存所有状态到 localStorage
  const saveStates = (states: Record<string, AudioViewState>) => {
    if (!isClient) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
    } catch (error) {
      console.error('Failed to save states:', error)
    }
  }

  // 获取指定音频的状态
  const loadState = (): AudioViewState | null => {
    if (!isClient) return null
    const states = loadStates()
    return states[audioId] || null
  }

  // 保存指定音频的状态
  const saveState = (state: AudioViewState) => {
    if (!isClient) return
    const states = loadStates()
    states[audioId] = state
    saveStates(states)
  }

  // 删除指定音频的状态
  const clearState = () => {
    if (!isClient) return
    const states = loadStates()
    delete states[audioId]
    saveStates(states)
  }

  // 当前状态
  const viewState = ref<AudioViewState | null>(null)
  
  // 在客户端初始化状态
  if (isClient) {
    viewState.value = loadState()
  }

  // 更新状态
  const updateState = (newState: Partial<AudioViewState>) => {
    if (!isClient) return
    
    // 确保 viewState.value 存在，如果不存在则创建一个新的
    if (!viewState.value) {
      viewState.value = {
        currentTime: 0,
        scrollPosition: 0,
        startTime: 0,
        endTime: 0,
        pixelsPerSecond: 50
      }
    }

    // 更新状态
    const updatedState = {
      ...viewState.value,
      ...newState
    }

    // 验证状态是否有变化
    const hasChanges = Object.entries(newState).some(([key, value]) => 
      viewState.value?.[key as keyof AudioViewState] !== value
    )

    if (!hasChanges) return

    viewState.value = updatedState

    // 保存状态
    try {
      saveState(updatedState)
    } catch (error) {
      console.error('保存状态失败:', error)
    }
  }

  return {
    viewState,
    updateState,
    clearState
  }
} 