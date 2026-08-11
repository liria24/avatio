import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { relations } from '~~/database/relations'
import * as schema from '~~/database/schema'

const getDatabaseUrl = () => {
    const databaseUrl = useRuntimeConfig().neon?.databaseUrl
    if (!databaseUrl) throw new Error('Missing required runtime config: neon.databaseUrl')
    return databaseUrl
}

const useDB = () =>
    drizzle({
        client: new Pool({ connectionString: getDatabaseUrl() }),
        relations,
    })

// Proxy that lazily calls useDB() on each property access,
// ensuring the Pool is always created within the current request context.
// This avoids Cloudflare Workers "Cannot perform I/O on behalf of a different request" errors.
const dbProxy = new Proxy({} as ReturnType<typeof useDB>, {
    get(_target, prop) {
        return useDB()[prop as keyof ReturnType<typeof useDB>]
    },
})

export { useDB, dbProxy, relations, schema }
