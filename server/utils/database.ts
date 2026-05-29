import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'

import { relations } from '../../database/relations'
import * as schema from '../../database/schema'

// const db = drizzle({ client, relations })
const useDB = () =>
    drizzle({
        client: new Pool({ connectionString: process.env.NEON_DATABASE_URL }),
        relations,
    })

export { useDB, relations, schema }
