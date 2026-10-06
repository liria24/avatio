import { z } from 'zod'

const query = z.object({
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(POPULAR_AVATARS_API_DEFAULT_LIMIT),
})

export default requestEventHandler(async ({ event, db }) => {
    const { limit } = validateRequestQuery(event, query)

    const result = await queryCatalogItems(db, {
        limit,
        publicAvatars: true,
        orderBy: 'popular',
        availability: ['available'],
    })
    applyPublicRequestCache(event, [EDGE_CACHE_TAGS.popularAvatars])
    return result.data
})
