# 音频组件

音频组件是 Visual Split Mark 的核心功能组件，负责音频的播放、可视化和控制。本文档详细介绍各个音频相关组件的实现和使用方法。

## AudioPlayer 组件

音频播放器组件是音频处理的核心，负责音频的加载、播放和控制。

### Props

```typescript
interface AudioPlayerProps {
  src: string              // 音频文件路径
  duration: number         // 音频时长（秒）
  currentTime?: number     // 当前播放位置（秒）
  playing?: boolean        // 是否正在播放
  volume?: number          // 音量（0-1）
}
```

### Events

```typescript
interface AudioPlayerEmits {
  'update:currentTime': [time: number]    // 更新当前时间
  'update:playing': [playing: boolean]    // 更新播放状态
  'loaded': []                            // 音频加载完成
  'ended': []                             // 播放结束
  'error': [error: Error]                 // 播放错误
}
```

### 使用示例

```vue
<template>
  <AudioPlayer
    :src="audioFile.wavPath"
    :duration="audioFile.duration"
    v-model:currentTime="currentTime"
    v-model:playing="isPlaying"
    :volume="0.8"
    @loaded="onAudioLoaded"
    @ended="onAudioEnded"
    @error="onAudioError"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AudioPlayer } from '~/components/audio'

const currentTime = ref(0)
const isPlaying = ref(false)

function onAudioLoaded() {
  console.log('音频加载完成')
}

function onAudioEnded() {
  isPlaying.value = false
}

function onAudioError(error: Error) {
  console.error('播放错误:', error)
}
</script>
```

## WaveformView 组件

波形显示组件使用 Wavesurfer.js 实现音频波形的可视化，支持波形导航和选择。

### Props

```typescript
interface WaveformViewProps {
  audioUrl: string         // 音频文件 URL
  height?: number          // 波形高度
  waveColor?: string      // 波形颜色
  progressColor?: string  // 进度颜色
  cursorColor?: string    // 光标颜色
  responsive?: boolean    // 是否响应式
  selections?: Selection[] // 选中区域
}

interface Selection {
  id: string
  start: number
  end: number
  color?: string
}
```

### Events

```typescript
interface WaveformViewEmits {
  'ready': []                                    // 波形加载完成
  'timeupdate': [time: number]                   // 时间更新
  'selection': [start: number, end: number]      // 区域选择
  'selection-play': [id: string]                 // 播放选中区域
  'error': [error: Error]                        // 加载错误
}
```

### 使用示例

```vue
<template>
  <WaveformView
    :audio-url="audioFile.wavPath"
    :height="128"
    wave-color="#4a5568"
    progress-color="#2b6cb0"
    cursor-color="#e53e3e"
    :selections="annotations"
    @ready="onWaveformReady"
    @timeupdate="onTimeUpdate"
    @selection="onSelection"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { WaveformView } from '~/components/audio'
import type { Selection } from '~/types'

const annotations = ref<Selection[]>([
  {
    id: '1',
    start: 10,
    end: 20,
    color: 'rgba(66, 153, 225, 0.3)'
  }
])

function onWaveformReady() {
  console.log('波形加载完成')
}

function onTimeUpdate(time: number) {
  console.log('当前时间:', time)
}

function onSelection(start: number, end: number) {
  console.log('选择区域:', start, end)
}
</script>
```

## Controls 组件

播放控制组件提供音频播放的用户界面，包括播放/暂停按钮、进度条和音量控制。

### Props

```typescript
interface ControlsProps {
  playing: boolean        // 是否正在播放
  currentTime: number     // 当前时间
  duration: number        // 总时长
  volume: number         // 音量
  canPlay: boolean       // 是否可以播放
}
```

### Events

```typescript
interface ControlsEmits {
  'play': []                             // 播放
  'pause': []                            // 暂停
  'seek': [time: number]                 // 跳转到指定时间
  'volume-change': [volume: number]      // 音量变化
}
```

### 使用示例

```vue
<template>
  <Controls
    :playing="isPlaying"
    :current-time="currentTime"
    :duration="duration"
    :volume="volume"
    :can-play="audioLoaded"
    @play="onPlay"
    @pause="onPause"
    @seek="onSeek"
    @volume-change="onVolumeChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Controls } from '~/components/audio'

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)
const audioLoaded = ref(false)

function onPlay() {
  isPlaying.value = true
}

function onPause() {
  isPlaying.value = false
}

function onSeek(time: number) {
  currentTime.value = time
}

function onVolumeChange(newVolume: number) {
  volume.value = newVolume
}
</script>
```

## 组件组合

这些组件通常一起使用，形成完整的音频播放和标注界面：

```vue
<template>
  <div class="audio-container">
    <AudioPlayer
      ref="player"
      v-bind="audioPlayerProps"
      v-on="audioPlayerEvents"
    />
    
    <WaveformView
      ref="waveform"
      v-bind="waveformProps"
      v-on="waveformEvents"
    />
    
    <Controls
      v-bind="controlsProps"
      v-on="controlsEvents"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAudioStore } from '~/stores/audio'
import { AudioPlayer, WaveformView, Controls } from '~/components/audio'

const store = useAudioStore()
const currentTime = ref(0)
const isPlaying = ref(false)
const volume = ref(0.8)

// 组件属性和事件的计算属性...
</script>

<style scoped>
.audio-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #f7fafc;
  border-radius: 0.5rem;
}
</style>
```

## 最佳实践

1. **性能优化**
   - 使用 `requestAnimationFrame` 更新波形
   - 避免频繁更新状态
   - 合理使用计算属性和缓存

2. **内存管理**
   - 及时销毁 Wavesurfer 实例
   - 清理音频资源
   - 移除事件监听器

3. **错误处理**
   - 处理音频加载失败
   - 提供加载状态反馈
   - 实现优雅降级

## 常见问题

1. **音频加载失败**
   ```typescript
   onMounted(() => {
     try {
       await player.value?.load(audioUrl)
     } catch (error) {
       console.error('音频加载失败:', error)
       // 显示错误提示
     }
   })
   ```

2. **波形渲染问题**
   ```typescript
   // 监听容器大小变化
   const resizeObserver = new ResizeObserver(() => {
     waveform.value?.drawWaveform()
   })
   
   onMounted(() => {
     resizeObserver.observe(container.value!)
   })
   
   onUnmounted(() => {
     resizeObserver.disconnect()
   })
   ```

3. **播放控制同步**
   ```typescript
   // 使用 watch 同步状态
   watch(isPlaying, (playing) => {
     if (playing) {
       player.value?.play()
     } else {
       player.value?.pause()
     }
   })
   ```

## 测试指南

1. **单元测试**
   ```typescript
   describe('AudioPlayer', () => {
     it('should emit loaded event when audio is loaded', async () => {
       // 测试代码...
     })
     
     it('should update current time while playing', async () => {
       // 测试代码...
     })
   })
   ```

2. **组件测试**
   ```typescript
   import { mount } from '@vue/test-utils'
   
   describe('Controls', () => {
     it('should emit play event when play button is clicked', async () => {
       // 测试代码...
     })
   })
   ```

## 相关文档

- [Wavesurfer.js 文档](https://wavesurfer-js.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [音频处理模块](../core/audio.md)
- [状态管理](../core/state.md) 