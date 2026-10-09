import type { BatchItem } from 'drizzle-orm/batch'

import { executeLocalBatch, isLocalDatabase, type AppDatabase } from './database'

export const executeAppBatch = async (db: AppDatabase, queries: BatchItem<'sqlite'>[]) => {
    const first = queries[0]
    if (!first) return []
    if (isLocalDatabase(db)) return executeLocalBatch(queries)

    const d1 = db as unknown as {
        batch(queries: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]): Promise<unknown[]>
    }
    return d1.batch([first, ...queries.slice(1)])
}
