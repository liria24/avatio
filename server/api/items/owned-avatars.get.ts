import { z } from 'zod'

const query = z.object({
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default authedSessionEventHandler<Item[]>(async ({ session }) => {
    const { limit } = await validateQuery(query)

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const data = await db.query.items.findMany({
        where: {
            outdated: { eq: false },
            category: { eq: 'avatar' },
            setupItems: {
                setup: {
                    userId: { eq: session!.user.id },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        limit,
    })

    // 1日以上古いアイテムのみフィルタリング
    const outdatedItems = data.filter((item) => item.updatedAt < oneDayAgo)

    // 古いアイテムを並列で更新（エラーハンドリング改善）
    const updatePromises = outdatedItems.map(async (item) => {
        try {
            // $fetchの使用を修正
            const response = await $fetch<Item>(`/api/items/${transformItemId(item.id).encode()}`)
            console.log(`Updated item ${item.id} from external API`)
            return { ...item, ...response }
        } catch (error) {
            console.error(`Failed to update item ${item.id}:`, error)
            return item // エラーの場合は元のデータを返す
        }
    })

    // 並列実行がある場合のみ待機
    const updatedItems = updatePromises.length > 0 ? await Promise.allSettled(updatePromises) : []

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

    defineCacheControl({ cdnAge: 60 * 10, clientAge: 0 })

    return result
})
