import { sql } from 'drizzle-orm'
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

    const data = await db.query.items.findMany({
        where: {
            outdated: { eq: false },
            category: { eq: 'avatar' },
            setupItems: {
                setup: {
                    public: { eq: true },
                    hidAt: { isNull: true },
                    user: {
                        OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                    },
                },
            },
        },
        orderBy: (t) => sql`(SELECT COUNT(*) FROM setup_items WHERE item_id = ${t.id}) DESC`,
        limit,
        columns: {
            id: true,
            platform: true,
            name: true,
            niceName: true,
            image: true,
            nsfw: true,
        },
    })

    applyPublicEdgeCache(event, [EDGE_CACHE_TAGS.popularAvatars])
    return data
})
