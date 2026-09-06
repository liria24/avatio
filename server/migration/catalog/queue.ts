import type { Queue } from '@cloudflare/workers-types'
import { z } from 'zod'
import { getRuntimeEnv } from '~~/server/utils/runtimeEnv'

import { CATALOG_MIGRATION_ID } from './migration'

export const catalogMigrationMessageSchema = z.object({
    type: z.literal('catalog.migration'),
    runId: z.literal(CATALOG_MIGRATION_ID),
})

export const enqueueCatalogMigration = async (delaySeconds = 0) => {
    const queue = getRuntimeEnv().ITEM_REVALIDATION_QUEUE as Queue | undefined
    if (!queue) throw new Error('Catalog migration Queue is unavailable.')
    await queue.send({ type: 'catalog.migration', runId: CATALOG_MIGRATION_ID }, { delaySeconds })
}
