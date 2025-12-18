import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { relations } from '../../database/relations'
import * as schema from '../../database/schema'

const db = drizzle({
    client: neon(process.env.NUXT_NEON_DATABASE_URL || ''),
    schema,
    relations,
})

export default db
export { db, relations, schema }
