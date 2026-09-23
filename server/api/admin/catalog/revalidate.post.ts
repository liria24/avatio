import { forceEnqueueCatalogSources } from '@avatio/core/catalog'
import { z } from 'zod'

const bodySchema = z.object({
    sourceIds: z.string().min(1).array().min(1).max(MAX_ITEMS_PER_SETUP),
})

export default promiseEventHandler(async ({ event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { sourceIds } = await validateBody(bodySchema)
    const queue = getCatalogSyncQueue()
    if (!queue)
        throw createError({ statusCode: 503, message: 'Catalog sync queue is unavailable.' })

    return forceEnqueueCatalogSources({
        sourceIds,
        repository: getCatalogRepository(),
        queue,
    })
})
