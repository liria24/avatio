import { items, shops } from '@@/database/schema'
import { getAll } from '@vercel/edge-config'
import { waitUntil } from '@vercel/functions'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24時間

const markItemAsOutdated = async (id: string): Promise<void> => {
    try {
        await db
            .update(items)
            .set({ outdated: true, updatedAt: new Date() })
            .where(eq(items.id, id))
    } catch (error) {
        consola.error(`Failed to mark item ${id} as outdated:`, error)
    }
}

const updateDatabase = async (item: Item & { shop: NonNullable<Item['shop']> }): Promise<void> => {
    try {
        // ショップ情報更新
        await db
            .insert(shops)
            .values({
                id: item.shop.id,
                platform: item.shop.platform,
                name: item.shop.name,
                image: item.shop.image,
                verified: item.shop.verified,
            })
            .onConflictDoUpdate({
                target: shops.id,
                set: {
                    name: item.shop.name,
                    image: item.shop.image,
                    verified: item.shop.verified,
                },
            })

        const itemData = {
            id: item.id,
            name: item.name,
            image: item.image,
            category: item.category,
            price: item.price,
            likes: item.likes,
            nsfw: item.nsfw,
            platform: item.platform,
            shopId: item.shop.id,
        }

        await db
            .insert(items)
            .values(itemData)
            .onConflictDoUpdate({
                target: items.id,
                set: {
                    ...itemData,
                    updatedAt: new Date(),
                    outdated: false,
                },
            })
    } catch (error) {
        consola.error(`Failed to update database for item ${item.id}:`, error)
        throw error
    }
}

export default defineApi<Item>(
    async () => {
        const { id } = await validateParams(params)

        const { forceUpdateItem, allowedBoothCategoryId, specificItemCategories } =
            await getAll<EdgeConfig>()

        const cachedItem = forceUpdateItem ? null : await getItemFromDatabase(id)

        const isCacheValid =
            cachedItem && Date.now() - new Date(cachedItem.updatedAt).getTime() < CACHE_DURATION_MS

        if (isCacheValid && !cachedItem.outdated) return cachedItem
        if (isCacheValid && cachedItem.outdated) throw new Error('Item not found or not allowed')

        const BOOTH_CATEGORY_MAP: Record<number, ItemCategory> = {
            208: 'avatar',
            209: 'clothing',
            217: 'accessory',
        }

        const item = await fetchBoothItem(id)

        if (!item || !allowedBoothCategoryId.includes(item.category.id)) {
            if (cachedItem) await markItemAsOutdated(id)
            throw new Error('Item not found or not allowed')
        }

        const category =
            Object.hasOwn(specificItemCategories, 'booth') &&
            Object.hasOwn(specificItemCategories['booth'], item.id)
                ? specificItemCategories['booth'][item.id]
                : BOOTH_CATEGORY_MAP[item.category.id] || 'other'

        const price = item.variations.some((v) => v.status === 'free_download')
            ? 'FREE'
            : item.price

        const processedItem = {
            id: item.id,
            platform: 'booth' as const,
            category,
            name: item.name,
            niceName: cachedItem?.niceName || null,
            image: item.images[0]?.original || '',
            price,
            likes: Number(item.wish_lists_count) || 0,
            nsfw: Boolean(item.is_adult),
            shop: {
                id: item.shop.subdomain,
                platform: 'booth' as const,
                name: item.shop.name,
                image: item.shop.thumbnail_url || '',
                verified: Boolean(item.shop.verified),
            },
            outdated: false,
        }

        // アイテム情報の更新処理
        // DBに無いあるいはforceUpdateItemがtrueの場合はniceNameとcategoryをAI生成
        waitUntil(
            updateDatabase(processedItem).then(async () => {
                if (!cachedItem)
                    try {
                        consola.log(`Defining item info for item ${id}`)
                        const { niceName, category } = await generateItemAttr({
                            name: item.name,
                            description: item.description || undefined,
                            category: processedItem.category,
                        })

                        await db.update(items).set({ niceName, category }).where(eq(items.id, id))
                        consola.log(`Item info defined for item ${id}: ${niceName}, ${category}`)
                    } catch (error) {
                        consola.error(`Failed to define item info for item ${id}:`, error)
                    }
            })
        )

        return processedItem
    },
    {
        errorMessage: 'Failed to get booth item.',
    }
)
