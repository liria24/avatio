import database from '@@/database'
import { items, shops } from '@@/database/schema'
import sanitizeObject from '@@/server/utils/sanitizeObject'
import { getAll } from '@vercel/edge-config'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const config = useRuntimeConfig()

// バリデーションスキーマ
const params = z.object({
    id: z.string(),
})

const query = z.object({
    platform: platformSchema.optional(),
})

// 定数定義
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24時間
const NICE_NAME_CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30日

const SPECIFIC_ITEM_CATEGORIES = {
    '3087170': 'shader', // lilToon
    '4841309': 'shader', // Poiyomi
} as const

const BOOTH_CATEGORY_MAP = {
    208: 'avatar',
    209: 'clothing',
    217: 'accessory',
} as const

// Boothアイテム取得
const fetchBoothItem = async (id: string): Promise<Booth | null> => {
    try {
        return await $fetch<Booth>(`https://booth.pm/ja/items/${id}.json`, {
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })
    } catch (error) {
        consola.error(`Failed to fetch booth item ${id}:`, error)
        return null
    }
}

// キャッシュされたアイテム取得
const getCachedItem = async (id: string) => {
    try {
        return await database.query.items.findFirst({
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
    } catch (error) {
        consola.error(`Failed to get cached item ${id}:`, error)
        return null
    }
}

// キャッシュ有効性チェック
const isCacheValid = (updatedAt: Date): boolean => {
    const timeDifference = Date.now() - new Date(updatedAt).getTime()
    return timeDifference < CACHE_DURATION_MS
}

// アイテムをoutdatedとしてマーク
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

// カテゴリマッピング
const mapItemCategory = (categoryId: number, itemId: string): ItemCategory => {
    // 特定アイテムのカテゴリ優先
    const specificCategory =
        SPECIFIC_ITEM_CATEGORIES[
            itemId as keyof typeof SPECIFIC_ITEM_CATEGORIES
        ]
    if (specificCategory) return specificCategory

    return (
        BOOTH_CATEGORY_MAP[categoryId as keyof typeof BOOTH_CATEGORY_MAP] ||
        'other'
    )
}

// Boothアイテム処理
const processBoothItem = (
    boothData: Booth,
    id: string,
    allowedCategoryIds: number[]
): Item | null => {
    // カテゴリチェック
    if (!allowedCategoryIds.includes(boothData.category.id)) {
        consola.warn(
            `Item ${id} category not allowed: ${boothData.category.id}`
        )
        return null
    }

    // 価格決定（無料ダウンロードがある場合はFREE）
    const price = boothData.variations.some((v) => v.status === 'free_download')
        ? 'FREE'
        : boothData.price

    return {
        id: boothData.id,
        platform: 'booth',
        category: mapItemCategory(boothData.category.id, id),
        name: boothData.name,
        niceName: null,
        image: boothData.images[0]?.original || '',
        price,
        likes: Number(boothData.wish_lists_count) || 0,
        nsfw: Boolean(boothData.is_adult),
        shop: {
            id: boothData.shop.subdomain,
            platform: 'booth',
            name: boothData.shop.name,
            image: boothData.shop.thumbnail_url || '',
            verified: Boolean(boothData.shop.verified),
        },
    }
}

// データベース更新
const updateDatabase = async (item: Item): Promise<void> => {
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

        // アイテム情報更新
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

// niceName定義
const defineNiceName = async (
    id: string,
    name: string,
    forceUpdate: boolean = false
) => {
    try {
        if (!forceUpdate) {
            const existingItem = await database.query.items.findFirst({
                where: (items, { eq }) => eq(items.id, id),
                columns: { niceName: true, updatedAt: true },
            })

            if (existingItem?.niceName) {
                const cacheExpiry = new Date(
                    Date.now() - NICE_NAME_CACHE_DURATION_MS
                )
                if (existingItem.updatedAt > cacheExpiry) {
                    consola.log(
                        `NiceName for item ${id} was recently updated, skipping`
                    )
                    return
                }
            }
        }

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

export default defineApi<
    Item,
    {
        errorMessage: 'Failed to get items.'
    }
>(async () => {
    const { id } = await validateParams(params)
    let { platform } = await validateQuery(query)

    const { forceUpdateItem, allowedBoothCategoryId } =
        await getAll<EdgeConfig>()

    consola.log(`Processing item: ${id}`)
    consola.log(`Platform: ${platform || 'auto-detect from cache'}`)
    consola.log(`Force update enabled: ${forceUpdateItem}`)

    try {
        let cachedData: Awaited<ReturnType<typeof getCachedItem>> = null

        // キャッシュチェック
        if (!forceUpdateItem) {
            cachedData = await getCachedItem(id)

            if (
                cachedData &&
                !cachedData.outdated &&
                isCacheValid(cachedData.updatedAt)
            )
                return cachedData

            platform = cachedData?.platform || platform
        }

        if (!platform)
            throw new Error(
                `Platform is required for item ${id} when no cached data exists`
            )

        consola.log(`Fetching item data from ${platform}: ${id}`)

        // 現在はBoothのみサポート
        if (platform !== 'booth')
            throw new Error(`Unsupported platform: ${platform}`)

        const itemData = await fetchBoothItem(id)
        const sanitizedData = sanitizeObject(itemData)

        if (!sanitizedData) {
            if (cachedData) {
                await markItemAsOutdated(id)
                consola.warn(
                    `Item ${id} not found on ${platform}, marked as outdated`
                )
                return { ...cachedData, outdated: true }
            }
            throw new Error(
                `Item ${id} not found on ${platform} and no cached data available`
            )
        }

        const processedItem = processBoothItem(
            sanitizedData,
            id,
            allowedBoothCategoryId
        )

        if (!processedItem) {
            if (cachedData) {
                await markItemAsOutdated(id)
                consola.warn(`Item ${id} processing failed, marked as outdated`)
                return { ...cachedData, outdated: true }
            }
            throw new Error(`Failed to process item ${id}`)
        }

        await updateDatabase(processedItem)

        if (processedItem.category === 'avatar')
            defineNiceName(
                processedItem.id,
                processedItem.name,
                forceUpdateItem
            ).catch((error) => {
                consola.error(
                    `Failed to define nice name for item ${id}:`,
                    error
                )
            })

        consola.log(`Item ${id} processed successfully`)
        return processedItem
    } catch (error) {
        consola.error(`Error processing item ${id}:`, error)
        throw createError({
            statusCode: 404,
            statusMessage: 'Item not found or processing failed',
        })
    }
})
