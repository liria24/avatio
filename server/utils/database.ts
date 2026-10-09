import type { D1Database } from '@cloudflare/workers-types'
import type { BatchItem } from 'drizzle-orm/batch'
import { drizzle } from 'drizzle-orm/d1'
import type { SQLiteAsyncDatabase } from 'drizzle-orm/sqlite-core'
import { relations } from '~~/database/relations'
import * as schema from '~~/database/schema'

export type AppDatabase = SQLiteAsyncDatabase<'sync' | 'async', unknown, typeof relations>

type LocalBatchExecutor = (queries: BatchItem<'sqlite'>[]) => unknown[]

let localDatabase: AppDatabase | undefined
let localBatchExecutor: LocalBatchExecutor | undefined

export const setLocalDatabase = (database: AppDatabase, executeBatch: LocalBatchExecutor) => {
    localDatabase = database
    localBatchExecutor = executeBatch
}

export const executeLocalBatch = (queries: BatchItem<'sqlite'>[]) => {
    if (!localBatchExecutor) throw new Error('Local SQLite has not been initialized.')
    return localBatchExecutor(queries)
}

export const isLocalDatabase = (database: AppDatabase) => database === localDatabase

export const getDatabaseBinding = () => {
    const binding = getRuntimeEnv().APP_DB
    if (!binding) throw new Error('Missing required Cloudflare D1 binding: APP_DB')
    return binding as D1Database
}

const useDB = (): AppDatabase => {
    if (import.meta.dev) {
        if (!localDatabase) throw new Error('Local SQLite has not been initialized.')
        return localDatabase
    }

    return drizzle(getDatabaseBinding(), { relations })
}

// Better Auth is initialized at module scope, while Nitro injects bindings at request time.
const dbProxy = new Proxy({} as AppDatabase, {
    get(_target, prop) {
        return useDB()[prop as keyof AppDatabase]
    },
})

export { useDB, dbProxy, relations, schema }
