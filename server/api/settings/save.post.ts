import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

const SETTINGS_PATH = join(process.cwd(), 'storage/settings/global.json')

export default defineEventHandler(async (event) => {
  const body = await readBody(event) || {}

  const validTypes = ['whisper', 'transcribeService', 'none']
  const transcribeType = validTypes.includes(body.transcribeType) ? body.transcribeType : 'none'

  const settings = {
    id: 'global',
    transcribeType,
    whisperApiUrl: body.whisperApiUrl || '',
    transcribeApiUrl: body.transcribeApiUrl || '',
    transcribeApiToken: body.transcribeApiToken || '',
    updatedAt: new Date().toISOString(),
  }

  await mkdir(dirname(SETTINGS_PATH), { recursive: true })
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2))

  return { success: true, settings }
})
