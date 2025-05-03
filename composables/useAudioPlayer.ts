import { ref } from 'vue'
import type { AudioFile } from '~/types/project'
import type { AudioPlayer } from '~/types/audio'
import { loadBlob, loadAudioBlobWithProgress } from '~/utils/file'

export type LoadingPhase = 'idle' | 'downloading' | 'decoding' | 'ready'

export function useAudioPlayer() {
  const audioContext = ref<AudioContext | null>(null)
  const audioElement = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const playbackRate = ref(1)
  let channelData: Float32Array | null = null
  
  // 新增状态
  const loadingPhase = ref<LoadingPhase>('idle')
  const loadingProgress = ref(0)

  const initialize = async (audioFile: AudioFile) => {
    try {
      // 重置状态
      loadingPhase.value = 'downloading'
      loadingProgress.value = 0
      
      // 创建音频元素
      audioElement.value = new Audio()
      audioElement.value.crossOrigin = 'anonymous'
      
      // 加载并解码音频文件
      const { blob, audioBuffer } = await loadAudioBlobWithProgress(
        audioFile.wavPath,
        (phase, progress) => {
          loadingPhase.value = phase === 'download' ? 'downloading' : 'decoding'
          loadingProgress.value = progress
        }
      )
      
      // 创建音频上下文
      audioContext.value = new AudioContext()
      
      // 设置音频数据
      duration.value = audioBuffer.duration
      channelData = audioBuffer.getChannelData(0)
      
      // 创建音频源
      audioElement.value.src = URL.createObjectURL(blob)
      const source = audioContext.value.createMediaElementSource(audioElement.value)
      source.connect(audioContext.value.destination)
      
      // 添加音频事件监听
      audioElement.value.addEventListener('play', () => {
        isPlaying.value = true
      })
      
      audioElement.value.addEventListener('pause', () => {
        isPlaying.value = false
      })
      
      audioElement.value.addEventListener('timeupdate', () => {
        currentTime.value = audioElement.value?.currentTime || 0
      })
      
      // 更新状态
      loadingPhase.value = 'ready'
      loadingProgress.value = 100
      
      return channelData
    } catch (error) {
      loadingPhase.value = 'idle'
      loadingProgress.value = 0
      throw error
    }
  }

  const playPause = async () => {
    if (!audioElement.value || !audioContext.value) return

    // 如果音频上下文被挂起，则恢复
    if (audioContext.value.state === 'suspended') {
      await audioContext.value.resume()
    }

    if (isPlaying.value) {
      audioElement.value.pause()
      console.log('暂停播放')
    } else {
      try {
        await audioElement.value.play()
        console.log('开始播放')
      } catch (error) {
        console.error('播放失败:', error)
      }
    }
  }

  const seek = (time: number) => {
    if (!audioElement.value || !duration.value) return
    audioElement.value.currentTime = Math.max(0, Math.min(time, duration.value))
  }

  const setPlaybackRate = (rate: number) => {
    if (!audioElement.value) return
    playbackRate.value = rate
    audioElement.value.playbackRate = rate
  }

  const destroy = () => {
    if (audioContext.value) {
      audioContext.value.close()
    }
    if (audioElement.value) {
      audioElement.value.pause()
      audioElement.value.src = ''
    }
    audioContext.value = null
    audioElement.value = null
    channelData = null
    isPlaying.value = false
    duration.value = 0
    currentTime.value = 0
  }

  return {
    audioContext,
    audioElement,
    isPlaying,
    duration,
    currentTime,
    playbackRate,
    channelData,
    // 新增返回值
    loadingPhase,
    loadingProgress,
    initialize,
    playPause,
    seek,
    setPlaybackRate,
    destroy
  }
} 