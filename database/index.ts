import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const sql = neon(import.meta.env.NUXT_DATABASE_URL)
const db = drizzle({ client: sql, schema })

export default db
