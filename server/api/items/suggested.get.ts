import { z } from 'zod'

const query = z.object({
    limit: z.coerce.number().min(1).max(24).optional().default(8),
})

export default authedSessionEventHandler<CatalogItemView[]>(async ({ event, session, db }) => {
    const { limit } = await validateQuery(query)
    const result = await queryCatalogItems(db, {
        limit,
        suggestedByOwnerId: session.user.id,
        availability: ['available'],
    })
    applyNoStoreCache(event)
    runAfterResponse(enqueueReferencedCatalogSources(result.data.map(({ id }) => id)))
    return result.data
})
