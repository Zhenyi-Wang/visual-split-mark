<template>
  <div class="page-container">
    <n-space vertical size="large">
      <n-page-header @back="handleBack">
        <template #title>
          音频标注 - {{ currentAudioFile?.originalName }}
        </template>
        <template #extra>
          <n-space>
            <n-button 
              type="primary" 
              ghost 
              @click="handleTranscribe" 
              :loading="transcribing"
              :disabled="!currentProject?.whisperApiUrl"
            >
              识别文本
            </n-button>
            <n-button 
              type="primary" 
              ghost 
              @click="handleExport" 
              :loading="exporting"
              :disabled="!annotations.length"
            >
              导出
            </n-button>
            <n-button type="primary" @click="handleSave" :loading="saving">
              保存
            </n-button>
          </n-space>
        </template>
      </n-page-header>

      <div class="annotation-container">
        <div class="waveform-container">
          <div ref="waveformRef" class="waveform"></div>
          <div class="waveform-controls">
            <n-space justify="center">
              <n-button circle @click="handlePlayPause">
                <template #icon>
                  <n-icon>
                    <component :is="isPlaying ? 'pause' : 'play'" />
                  </n-icon>
                </template>
              </n-button>
            </n-space>
          </div>
        </div>
      </div>
    </n-space>
  </div>
</template> 