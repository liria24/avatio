import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import { relations } from '~~/database/relations'
import * as schema from '~~/database/schema'

const getDatabaseBinding = () => {
    const binding = getRuntimeEnv().APP_DB
    if (!binding) throw new Error('Missing required Cloudflare D1 binding: APP_DB')
    return binding as D1Database
}

const useDB = () => drizzle(getDatabaseBinding(), { relations })

// Better Auth is initialized at module scope, while Nitro injects bindings at request time.
const dbProxy = new Proxy({} as ReturnType<typeof useDB>, {
    get(_target, prop) {
        return useDB()[prop as keyof ReturnType<typeof useDB>]
    },
})

export { useDB, dbProxy, relations, schema }
