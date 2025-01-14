import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js'
import { loadBlob } from '~/utils/file'
import type { AudioFile, Annotation } from '~/types/project'

interface WaveSurferWithPlugins extends WaveSurfer {
  addRegion: (options: any) => Region
  clearRegions: () => void
}

export function useWavesurfer() {
  const wavesurfer = ref<WaveSurferWithPlugins | null>(null)
  const regions = ref<Map<string, Region>>(new Map())
  const isReady = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const isPlaying = ref(false)

  const initialize = async (container: HTMLElement, audioFile: AudioFile) => {
    // 创建 Wavesurfer 实例
    wavesurfer.value = WaveSurfer.create({
      container,
      waveColor: '#4a9eff',
      progressColor: '#2c5282',
      cursorColor: '#2c5282',
      height: 128,
      normalize: true,
      plugins: [
        RegionsPlugin.create(),
        TimelinePlugin.create({
          container: container,
          timeInterval: 0.5,
          primaryLabelInterval: 5,
          secondaryLabelInterval: 1
        })
      ]
    }) as WaveSurferWithPlugins

    // 加载音频文件
    const blob = await loadBlob(audioFile.wavPath)
    if (!blob) {
      throw new Error('Failed to load audio file')
    }
    await wavesurfer.value.loadBlob(blob)

    // 设置事件监听
    wavesurfer.value.on('ready', () => {
      isReady.value = true
      duration.value = wavesurfer.value?.getDuration() || 0
    })

    wavesurfer.value.on('timeupdate', (time) => {
      currentTime.value = time
    })

    wavesurfer.value.on('play', () => {
      isPlaying.value = true
    })

    wavesurfer.value.on('pause', () => {
      isPlaying.value = false
    })

    // 区域事件
    wavesurfer.value.on('region-created' as any, (region: Region) => {
      regions.value.set(region.id, region)
    })

    wavesurfer.value.on('region-updated' as any, (region: Region) => {
      regions.value.set(region.id, region)
    })

    wavesurfer.value.on('region-removed' as any, (region: Region) => {
      regions.value.delete(region.id)
    })
  }

  const destroy = () => {
    if (wavesurfer.value) {
      wavesurfer.value.destroy()
      wavesurfer.value = null
    }
    isReady.value = false
    duration.value = 0
    currentTime.value = 0
    isPlaying.value = false
    regions.value.clear()
  }

  const playPause = () => {
    wavesurfer.value?.playPause()
  }

  const stop = () => {
    wavesurfer.value?.stop()
  }

  const seek = (time: number) => {
    wavesurfer.value?.setTime(time)
  }

  const addRegion = (annotation: Annotation) => {
    if (!wavesurfer.value) return null

    const region = wavesurfer.value.addRegion({
      id: annotation.id,
      start: annotation.start,
      end: annotation.end,
      color: 'rgba(74, 158, 255, 0.2)',
      drag: true,
      resize: true
    })

    regions.value.set(annotation.id, region)
    return region
  }

  const removeRegion = (id: string) => {
    const region = regions.value.get(id)
    if (region) {
      region.remove()
      regions.value.delete(id)
    }
  }

  const updateRegion = (annotation: Annotation) => {
    const region = regions.value.get(annotation.id)
    if (region) {
      region.setOptions({
        start: annotation.start,
        end: annotation.end
      })
    } else {
      addRegion(annotation)
    }
  }

  const clearRegions = () => {
    if (!wavesurfer.value) return
    wavesurfer.value.clearRegions()
    regions.value.clear()
  }

  onUnmounted(() => {
    destroy()
  })

  return {
    wavesurfer,
    regions,
    isReady,
    duration,
    currentTime,
    isPlaying,
    initialize,
    destroy,
    playPause,
    stop,
    seek,
    addRegion,
    removeRegion,
    updateRegion,
    clearRegions
  }
} 