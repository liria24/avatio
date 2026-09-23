import { z } from 'zod'

const query = z.object({
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(POPULAR_AVATARS_API_DEFAULT_LIMIT),
})

export default promiseEventHandler(async ({ event, db }) => {
    const { limit } = await validateQuery(query)

    const result = await queryCatalogItems(db, {
        limit,
        publicAvatars: true,
        orderBy: 'popular',
        availability: ['available'],
    })
    applyPublicEdgeCache(event, [EDGE_CACHE_TAGS.popularAvatars])
    return result.data
})
