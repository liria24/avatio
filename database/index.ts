import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(import.meta.env.NUXT_NEON_DATABASE_URL || '')
const db = drizzle({ client: sql, schema })

export default db
