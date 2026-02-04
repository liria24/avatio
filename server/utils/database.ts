import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'

import { relations } from '../../database/relations'
import * as schema from '../../database/schema'

neonConfig.webSocketConstructor = WebSocket

const pool = new Pool({ connectionString: process.env.NUXT_NEON_DATABASE_URL! })
const db = drizzle({ client: pool, schema, relations })

export default db
export { db, relations, schema }
