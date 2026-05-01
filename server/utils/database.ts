import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'

import { relations } from '../../database/relations'
import * as schema from '../../database/schema'

const client = new Pool({ connectionString: process.env.NEON_DATABASE_URL })
const db = drizzle({ client, relations, ws: WebSocket, jit: true })

export default db
export { db, relations, schema }
