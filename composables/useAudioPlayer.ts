import { ref } from 'vue'
import type { AudioFile } from '~/types/project'
import type { AudioPlayer } from '~/types/audio'
import { loadBlob } from '~/utils/file'

export function useAudioPlayer() {
  const audioContext = ref<AudioContext | null>(null)
  const audioElement = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const playbackRate = ref(1)
  let channelData: Float32Array | null = null

  const initialize = async (audioFile: AudioFile) => {
    // 创建音频元素
    audioElement.value = new Audio()
    audioElement.value.crossOrigin = 'anonymous'
    
    // 加载音频文件
    const blob = await loadBlob(audioFile.wavPath)
    if (!blob) {
      throw new Error('Failed to load audio file')
    }
    const arrayBuffer = await blob.arrayBuffer()
    
    // 创建音频上下文
    audioContext.value = new AudioContext()
    
    // 解码音频数据
    const audioBuffer = await audioContext.value.decodeAudioData(arrayBuffer)
    duration.value = audioBuffer.duration
    
    // 获取波形数据
    channelData = audioBuffer.getChannelData(0)
    
    // 创建音频源并连接
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

    return channelData
  }

  const playPause = async () => {
    if (!audioElement.value || !audioContext.value) return

    // 如果音频上下文被挂起，则恢复
    if (audioContext.value.state === 'suspended') {
      await audioContext.value.resume()
    }

    if (isPlaying.value) {
      audioElement.value.pause()
    } else {
      await audioElement.value.play()
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
    initialize,
    playPause,
    seek,
    setPlaybackRate,
    destroy
  }
} 