import type { D1Database } from '@cloudflare/workers-types'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { relations } from '~~/database/relations'
import * as schema from '~~/database/schema'

export type AppDatabase = DrizzleD1Database<typeof relations>

export const getDatabaseBinding = () => {
    const binding = getRuntimeEnv().APP_DB
    if (!binding || typeof binding.prepare !== 'function' || typeof binding.batch !== 'function')
        throw new Error('Missing required Cloudflare D1 binding: APP_DB')
    return binding as D1Database
}

const useDB = (): AppDatabase => {
    return drizzle(getDatabaseBinding(), { relations })
}

// Better Auth is initialized at module scope, while Nitro injects bindings at request time.
const dbProxy = new Proxy({} as AppDatabase, {
    get(_target, prop) {
        return useDB()[prop as keyof AppDatabase]
    },
})

export { useDB, dbProxy, relations, schema }
