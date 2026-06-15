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

const getPopularAvatars = defineCachedFunction(
    async (db: ReturnType<typeof useDB>, limit: number) => {
        return await db.query.items.findMany({
            where: {
                outdated: { eq: false },
                category: { eq: 'avatar' },
                setupItems: {
                    setup: {
                        public: { eq: true },
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
    },
    {
        name: 'popular-avatars',
        maxAge: 60 * 60 * 24,
        getKey: (_db, limit) => String(limit),
        swr: false,
    },
)

export default promiseEventHandler(async ({ db }) => {
    const { limit } = await validateQuery(query)

    return await getPopularAvatars(db, limit)
})
