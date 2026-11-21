import type { D1Database } from '@cloudflare/workers-types'
import { sql, type SQLWrapper } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
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

export const executeAppBatch = async (db: AppDatabase, queries: BatchItem<'sqlite'>[]) => {
    const first = queries[0]
    if (!first) return []
    return db.batch([first, ...queries.slice(1)])
}

// D1 limits LIKE patterns to 50 bytes; user searches are literal text.
export const searchText = (
    column: SQLWrapper,
    value: string,
    operator: 'contains' | 'starts_with' | 'ends_with' = 'contains',
) => {
    if (operator === 'ends_with')
        return sql`substr(lower(${column}), -length(${value})) = lower(${value})`
    const position = sql`instr(lower(${column}), lower(${value}))`
    return operator === 'starts_with' ? sql`${position} = 1` : sql`${position} > 0`
}

export { useDB, dbProxy, relations, schema }
