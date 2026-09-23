import { z } from 'zod'

const query = z.object({
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(OWNED_AVATARS_API_DEFAULT_LIMIT),
})

export default authedSessionEventHandler<CatalogItemView[]>(async ({ event, session, db }) => {
    const { limit } = await validateQuery(query)

    const result = await queryCatalogItems(db, { limit, ownerId: session.user.id })
    applyNoStoreCache(event)
    runAfterResponse(enqueueReferencedCatalogSources(result.data.map((item) => item.id)))
    return result.data.filter((item) => item.primarySource?.availability === 'available')
})
