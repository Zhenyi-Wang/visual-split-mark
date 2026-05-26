import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const SETTINGS_PATH = join(process.cwd(), 'storage/settings/global.json')

const DEFAULT_SETTINGS = {
  id: 'global',
  transcribeType: 'none',
  whisperApiUrl: '',
  transcribeApiUrl: '',
  transcribeApiToken: '',
}

export default defineEventHandler(async () => {
  try {
    const content = await readFile(SETTINGS_PATH, 'utf-8')
    const saved = JSON.parse(content)
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return DEFAULT_SETTINGS
  }
})
