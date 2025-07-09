import database from '@@/database'
import { items, setupItems, setups, shops } from '@@/database/schema'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<
    Item[],
    {
        errorMessage: 'Failed to get user owned avatars.'
        requireSession: true
    }
>(async ({ session }) => {
    const { limit } = await validateQuery(query)

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const data = await database
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
            shop: {
                id: shops.id,
                name: shops.name,
                image: shops.image,
                verified: shops.verified,
                platform: shops.platform,
            },
        })
        .from(items)
        .innerJoin(shops, eq(items.shopId, shops.id))
        .innerJoin(setupItems, eq(setupItems.itemId, items.id))
        .innerJoin(
            setups,
            and(
                eq(setupItems.setupId, setups.id),
                eq(setups.userId, session.user.id)
            )
        )
        .where(and(eq(items.outdated, false), eq(items.category, 'avatar')))
        .groupBy(items.id, shops.id)
        .orderBy(desc(items.createdAt))
        .limit(limit)

    // 古いアイテムを並列で更新
    const updatePromises = data
        .filter((item) => item.updatedAt < oneDayAgo)
        .map(async (item) => {
            try {
                const response = await useEvent().$fetch<Item>(
                    `/api/items/${item.id}`
                )
                console.log(`Updated item ${item.id} from external API`)
                return { ...item, ...response }
            } catch (error) {
                console.error(`Failed to update item ${item.id}:`, error)
                return item // エラーの場合は元のデータを返す
            }
        })

    // 並列実行の完了を待つ
    const updatedItems = await Promise.all(updatePromises)

    // 更新されたアイテムを元のデータに反映
    const updatedItemsMap = new Map(updatedItems.map((item) => [item.id, item]))

    const result = data.map((item) => {
        const updatedItem = updatedItemsMap.get(item.id) || item
        return {
            ...updatedItem,
            createdAt: updatedItem.createdAt.toISOString(),
            updatedAt: updatedItem.updatedAt.toISOString(),
        }
    })

    return result
})
