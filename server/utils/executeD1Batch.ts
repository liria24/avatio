import type { BatchItem } from 'drizzle-orm/batch'

export const executeD1Batch = async (
    db: ReturnType<typeof useDB>,
    queries: BatchItem<'sqlite'>[],
) => {
    const first = queries[0]
    if (!first) return []

    return (await db.batch([first, ...queries.slice(1)])) as unknown[]
}
