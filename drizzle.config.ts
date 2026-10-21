import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migraciones',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
