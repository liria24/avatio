import database from '@@/database'
import { items, shops } from '@@/database/schema'
import { getAll } from '@vercel/edge-config'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24時間

const config = useRuntimeConfig()

// キャッシュ有効性チェック
const isCacheValid = (item: {
    updatedAt: Date
    outdated: boolean
}): boolean => {
    if (item.outdated) return false

    const timeDifference = Date.now() - new Date(item.updatedAt).getTime()
    return timeDifference < CACHE_DURATION_MS
}

const getCachedItem = async (id: string) => {
    try {
        const cached = await database.query.items.findFirst({
            where: (items, { eq }) => eq(items.id, id),
            columns: {
                id: true,
                updatedAt: true,
                name: true,
                niceName: true,
                image: true,
                category: true,
                price: true,
                likes: true,
                nsfw: true,
                outdated: true,
                platform: true,
            },
            with: {
                shop: {
                    columns: {
                        id: true,
                        platform: true,
                        name: true,
                        image: true,
                        verified: true,
                    },
                },
            },
        })

        return cached || null
    } catch (error) {
        consola.error(`Failed to get cached item ${id}:`, error)
        return null
    }
}

// データベース更新をバックグラウンドで行う関数
const updateItemInBackground = (
    item: Item & { shop: NonNullable<Item['shop']> }
) => {
    // アイテム情報の更新処理
    const updatePromise = updateDatabase(item).then(() => {
        if (item.category === 'avatar' && !item.niceName)
            return defineNiceName(item.id, item.name)
    })

    updatePromise.catch((error) => {
        consola.error(`Failed to update item ${item.id}:`, error)
    })
}

const updateDatabase = async (
    item: Item & { shop: NonNullable<Item['shop']> }
): Promise<void> => {
    try {
        // ショップ情報更新
        await database
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

        await database
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

const markItemAsOutdated = async (id: string): Promise<void> => {
    try {
        await database
            .update(items)
            .set({ outdated: true })
            .where(eq(items.id, id))
    } catch (error) {
        consola.error(`Failed to mark item ${id} as outdated:`, error)
    }
}

const defineNiceName = async (id: string, name: string) => {
    try {
        consola.log(`Defining nice name for item ${id}`)
        const result = await $fetch('/api/items/extract-item-name', {
            headers: { authorization: `Bearer ${config.adminKey}` },
            query: { item: name },
        })

        await database
            .update(items)
            .set({ niceName: result })
            .where(eq(items.id, id))
        consola.log(`Nice name defined for item ${id}: ${result}`)
    } catch (error) {
        consola.error(`Failed to define nice name for item ${id}:`, error)
    }
}

interface Options {
    platform?: Platform
}

export default async (id: string, options?: Options): Promise<Item | null> => {
    const { forceUpdateItem, allowedBoothCategoryId, specificItemCategories } =
        await getAll<EdgeConfig>()

    const cachedItem = forceUpdateItem ? null : await getCachedItem(id)
    if (cachedItem && isCacheValid(cachedItem)) return cachedItem

    const platform = options?.platform || cachedItem?.platform

    if (!platform) return null

    if (platform === 'booth') {
        const BOOTH_CATEGORY_MAP: Record<number, ItemCategory> = {
            208: 'avatar',
            209: 'clothing',
            217: 'accessory',
        }

        const item = await fetchItem(id, platform)

        if (!item || !allowedBoothCategoryId.includes(item.category.id)) {
            if (cachedItem) await markItemAsOutdated(id)
            return null
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
        }

        updateItemInBackground(processedItem)

        return processedItem
    } else {
        return null
    }
}
