import type { Config } from 'drizzle-kit'
import { join } from 'path'

export default {
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
  verbose: true,
  strict: true
} satisfies Config 