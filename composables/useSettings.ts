// composables/useSettings.ts
export interface GlobalSettings {
  id: string
  transcribeType: 'whisper' | 'transcribeService' | 'none'
  whisperApiUrl: string
  transcribeApiUrl: string
  transcribeApiToken: string
  updatedAt?: string
}

const settings = ref<GlobalSettings>({
  id: 'global',
  transcribeType: 'none',
  whisperApiUrl: '',
  transcribeApiUrl: '',
  transcribeApiToken: '',
})

const loaded = ref(false)

export function useSettings() {
  const loadSettings = async () => {
    if (loaded.value) return
    try {
      const data = await $fetch<GlobalSettings>('/api/settings/load')
      settings.value = data
      loaded.value = true
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async (data: Partial<GlobalSettings>) => {
    try {
      const result = await $fetch<{ success: boolean; settings: GlobalSettings }>('/api/settings/save', {
        method: 'POST',
        body: data,
      })
      if (result.settings) {
        settings.value = result.settings
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      throw error
    }
  }

  const isTranscribeConfigured = computed(
    () => settings.value.transcribeType !== 'none'
      && (settings.value.transcribeType === 'whisper' ? !!settings.value.whisperApiUrl : !!settings.value.transcribeApiUrl)
  )

  return {
    settings: readonly(settings),
    loadSettings,
    saveSettings,
    isTranscribeConfigured,
  }
}
