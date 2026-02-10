import { items, setupItems, shops } from '@@/database/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(POPULAR_AVATARS_API_DEFAULT_LIMIT),
})

export default promiseEventHandler<Item[]>(async () => {
    const { limit } = await validateQuery(query)

    const data = await db
        .select({
            id: items.id,
            createdAt: items.createdAt,
            updatedAt: items.updatedAt,
            platform: items.platform,
            category: items.category,
            name: items.name,
            niceName: items.niceName,
            image: items.image,
            price: items.price,
            likes: items.likes,
            nsfw: items.nsfw,
            count: count(setupItems.itemId).as('usage_count'),
            shop: {
                id: shops.id,
                name: shops.name,
                image: shops.image,
                verified: shops.verified,
                platform: shops.platform,
            },
            outdated: items.outdated,
        })
        .from(setupItems)
        .innerJoin(items, eq(setupItems.itemId, items.id))
        .innerJoin(shops, eq(items.shopId, shops.id))
        .where(and(eq(items.outdated, false), eq(items.category, 'avatar')))
        .groupBy(items.id, shops.id)
        .orderBy(desc(count(setupItems.itemId)))
        .limit(limit)

    defineCacheControl({ cdnAge: 60 * 60 * 24, clientAge: 60 * 60 })

    return data
})
