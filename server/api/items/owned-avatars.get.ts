import database from '@@/database'
import { items, setupItems, setups, shops } from '@@/database/schema'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<Item[]>(
    async ({ session }) => {
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
                outdated: items.outdated,
            })
            .from(items)
            .innerJoin(shops, eq(items.shopId, shops.id))
            .innerJoin(setupItems, eq(setupItems.itemId, items.id))
            .innerJoin(
                setups,
                and(
                    eq(setupItems.setupId, setups.id),
                    eq(setups.userId, session!.user.id)
                )
            )
            .where(and(eq(items.outdated, false), eq(items.category, 'avatar')))
            .groupBy(items.id, shops.id)
            .orderBy(desc(items.createdAt))
            .limit(limit)

        // 1日以上古いアイテムのみフィルタリング
        const outdatedItems = data.filter((item) => item.updatedAt < oneDayAgo)

        // 古いアイテムを並列で更新（エラーハンドリング改善）
        const updatePromises = outdatedItems.map(async (item) => {
            try {
                // $fetchの使用を修正
                const response = await $fetch<Item>(
                    `/api/items/${transformItemId(item.id).encode()}`
                )
                console.log(`Updated item ${item.id} from external API`)
                return { ...item, ...response }
            } catch (error) {
                console.error(`Failed to update item ${item.id}:`, error)
                return item // エラーの場合は元のデータを返す
            }
        })

        // 並列実行がある場合のみ待機
        const updatedItems =
            updatePromises.length > 0
                ? await Promise.allSettled(updatePromises)
                : []

        // Promise.allSettledの結果を処理
        const updatedItemsMap = new Map<string, Item>()
        updatedItems.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const item = result.value
                updatedItemsMap.set(item.id, item)
            } else {
                // rejected の場合は元のアイテムを使用
                const originalItem = outdatedItems[index]
                if (originalItem) {
                    updatedItemsMap.set(originalItem.id, originalItem)
                }
            }
        })

        // 結果をマッピング
        const result = data.map((item) => updatedItemsMap.get(item.id) || item)

        return result
    },
    {
        errorMessage: 'Failed to get user owned avatars.',
        requireSession: true,
    }
)
