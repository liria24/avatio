import type { BatchItem } from 'drizzle-orm/batch'

import type { AppDatabase } from './database'

export const executeAppBatch = async (db: AppDatabase, queries: BatchItem<'sqlite'>[]) => {
    const first = queries[0]
    if (!first) return []
    return db.batch([first, ...queries.slice(1)])
}
