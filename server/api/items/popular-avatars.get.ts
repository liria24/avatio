import database from '@@/database'
import { items, setupItems, shops } from '@@/database/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<Item[]>(
    async () => {
        const { limit } = await validateQuery(query)

        const data = await database
            .select({
                id: items.id,
                createdAt: items.createdAt,
                updatedAt: items.updatedAt,
                platform: items.platform,
                category: items.category,
                name: items.name,
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
            })
            .from(setupItems)
            .innerJoin(items, eq(setupItems.itemId, items.id))
            .innerJoin(shops, eq(items.shopId, shops.id))
            .where(and(eq(items.outdated, false), eq(items.category, 'avatar')))
            .groupBy(items.id, shops.id)
            .orderBy(desc(count(setupItems.itemId)))
            .limit(limit)

        const result = data.map((item) => ({
            id: item.id,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
            platform: item.platform,
            category: item.category,
            name: item.name,
            image: item.image,
            price: item.price,
            likes: item.likes,
            nsfw: item.nsfw,
            shop: item.shop,
        }))

        return result
    },
    {
        errorMessage: 'Failed to get popular avatars.',
    }
)
