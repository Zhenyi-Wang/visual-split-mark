import { ref, computed } from 'vue'

/**
 * 波形处理工具 - 用于DOM标注接口
 * 用于处理波形数据的下采样和峰值计算
 */
export function useDOMWaveformProcessor() {
  // 状态变量
  const isProcessing = ref(false)
  const processProgress = ref(0)
  
  /**
   * 对音频数据进行下采样，生成适合不同缩放级别的波形数据
   * @param audioData 原始音频数据数组
   * @param sampleRate 音频采样率
   * @param pixelsPerSecond 每秒像素数（缩放级别）
   */
  const createDownsampledData = (
    audioData: number[], 
    sampleRate: number, 
    pixelsPerSecond: number
  ) => {
    if (!audioData || audioData.length === 0) return []
    
    isProcessing.value = true
    processProgress.value = 0
    
    // 计算下采样率
    // 例如：如果原始采样率是44100Hz，每像素显示100个样本，那么我们需要44100/100=441个样本点来表示1秒
    const samplesPerPixel = Math.ceil(sampleRate / pixelsPerSecond)
    
    // 初始化结果数组
    const result: number[] = []
    
    // 处理数据
    const totalSamples = audioData.length
    const totalPixels = Math.ceil(totalSamples / samplesPerPixel)
    
    for (let i = 0; i < totalPixels; i++) {
      const startSample = i * samplesPerPixel
      const endSample = Math.min(startSample + samplesPerPixel, totalSamples)
      
      let sum = 0
      for (let j = startSample; j < endSample; j++) {
        sum += audioData[j]
      }
      
      // 计算平均值
      const average = sum / (endSample - startSample)
      result.push(average)
      
      // 更新进度
      if (i % 1000 === 0) {
        processProgress.value = Math.round((i / totalPixels) * 100)
      }
    }
    
    isProcessing.value = false
    processProgress.value = 100
    
    return result
  }
  
  /**
   * 计算峰值数据，用于加速波形渲染
   * @param audioData 原始音频数据
   * @param sampleRate 音频采样率
   * @param pixelsPerSecond 每秒像素数（缩放级别）
   */
  const createPeakData = (
    audioData: number[], 
    sampleRate: number, 
    pixelsPerSecond: number
  ) => {
    if (!audioData || audioData.length === 0) return []
    
    isProcessing.value = true
    processProgress.value = 0
    
    // 计算下采样率
    const samplesPerPixel = Math.ceil(sampleRate / pixelsPerSecond)
    
    // 初始化结果数组 - [min, max] 对
    const result: number[] = []
    
    // 处理数据
    const totalSamples = audioData.length
    const totalPixels = Math.ceil(totalSamples / samplesPerPixel)
    
    for (let i = 0; i < totalPixels; i++) {
      const startSample = i * samplesPerPixel
      const endSample = Math.min(startSample + samplesPerPixel, totalSamples)
      
      let min = Infinity
      let max = -Infinity
      
      for (let j = startSample; j < endSample; j++) {
        const value = audioData[j]
        if (value < min) min = value
        if (value > max) max = value
      }
      
      // 存储最小值和最大值
      result.push(min, max)
      
      // 更新进度
      if (i % 1000 === 0) {
        processProgress.value = Math.round((i / totalPixels) * 100)
      }
    }
    
    isProcessing.value = false
    processProgress.value = 100
    
    return result
  }
  
  /**
   * 对音频数据进行归一化处理，将振幅标准化到 [-1, 1] 范围
   * @param audioData 原始音频数据
   */
  const normalizeAudioData = (audioData: number[]) => {
    if (!audioData || audioData.length === 0) return []
    
    isProcessing.value = true
    processProgress.value = 0
    
    // 查找最大振幅
    let maxAmplitude = 0
    for (let i = 0; i < audioData.length; i++) {
      const absValue = Math.abs(audioData[i])
      if (absValue > maxAmplitude) {
        maxAmplitude = absValue
      }
      
      // 更新进度
      if (i % 100000 === 0) {
        processProgress.value = Math.round((i / audioData.length) * 50)
      }
    }
    
    // 如果最大振幅为0或接近0，返回原始数据
    if (maxAmplitude < 0.0001) {
      isProcessing.value = false
      processProgress.value = 100
      return [...audioData]
    }
    
    // 归一化数据
    const normalizedData = new Array(audioData.length)
    for (let i = 0; i < audioData.length; i++) {
      normalizedData[i] = audioData[i] / maxAmplitude
      
      // 更新进度
      if (i % 100000 === 0) {
        processProgress.value = 50 + Math.round((i / audioData.length) * 50)
      }
    }
    
    isProcessing.value = false
    processProgress.value = 100
    
    return normalizedData
  }
  
  return {
    // 状态
    isProcessing: computed(() => isProcessing.value),
    processProgress: computed(() => processProgress.value),
    
    // 方法
    createDownsampledData,
    createPeakData,
    normalizeAudioData
  }
}
