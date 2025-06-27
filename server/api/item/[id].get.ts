import database from '@@/database'
import { items, shops } from '@@/database/schema'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const params = z.object({
    id: z.string(),
})

const query = z.object({
    platform: platformSchema.optional(),
})

// 定数定義
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24時間
const SPECIFIC_ITEM_CATEGORIES = {
    '3087170': 'shader', // lilToon
    '4841309': 'shader', // Poiyomi
} as const

const BOOTH_CATEGORY_MAP = {
    208: 'avatar',
    209: 'clothing',
    217: 'accessory',
} as const

const PLATFORM_URLS = {
    booth: (id: string) => `https://booth.pm/ja/items/${id}.json`,
} as const

const fetchItem = async (
    id: string,
    platform: Platform
): Promise<Booth | null> => {
    try {
        if (platform !== 'booth') {
            throw new Error(`Unsupported platform: ${platform}`)
        }

        return await $fetch<Booth>(PLATFORM_URLS.booth(id), {
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })
    } catch (error) {
        consola.error(`Failed to fetch item ${id} from ${platform}:`, error)
        return null
    }
}

const specificItemCategory = (id: string): ItemCategory | null => {
    return (
        SPECIFIC_ITEM_CATEGORIES[id as keyof typeof SPECIFIC_ITEM_CATEGORIES] ||
        null
    )
}

const mapCategoryToItemCategory = (
    platform: Platform,
    categoryId: number,
    itemId: string
): ItemCategory => {
    const specificCategory = specificItemCategory(itemId)
    if (specificCategory) return specificCategory

    const platformCategoryMaps: Record<
        Platform,
        Record<number, ItemCategory>
    > = {
        booth: BOOTH_CATEGORY_MAP,
    }

    const categoryMap = platformCategoryMaps[platform] || {}
    return categoryMap[categoryId] || 'other'
}

const getCachedItem = async (id: string) => {
    try {
        return (
            (await database.query.items.findFirst({
                where: (items, { eq }) => eq(items.id, id),
                columns: {
                    id: true,
                    updatedAt: true,
                    name: true,
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
            })) || null
        )
    } catch (error) {
        consola.error(`Failed to get cached item ${id}:`, error)
        return null
    }
}

const isCacheValid = (updatedAt: Date): boolean => {
    const timeDifference = new Date().getTime() - new Date(updatedAt).getTime()
    return timeDifference < CACHE_DURATION_MS
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

const processItem = async (
    id: string,
    platform: Platform | undefined,
    allowedBoothCategoryId: number[],
    forceUpdate: boolean
): Promise<Item | null> => {
    try {
        let cachedData

        // キャッシュチェック（forceUpdateでない場合のみ）
        if (!forceUpdate) {
            cachedData = await getCachedItem(id)

            // 有効なキャッシュが存在する場合は返す
            if (
                cachedData &&
                !cachedData.outdated &&
                isCacheValid(cachedData.updatedAt)
            ) {
                return cachedData
            }

            // キャッシュデータが存在する場合はそのプラットフォーム情報を使用
            platform = cachedData?.platform || platform
        }

        // platformが未定義の場合はエラー
        if (!platform) {
            throw new Error(
                `Platform is required for item ${id} when no cached data exists`
            )
        }

        consola.log(`Fetching item data from ${platform}:`, id)

        // アイテムデータの取得
        const itemData = await fetchItem(id, platform)
        const sanitizedData = sanitizeObject(itemData)

        if (!sanitizedData) {
            // キャッシュデータがある場合はoutdatedとして返す
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

        // プラットフォーム別の処理
        const processedItem = await processItemByPlatform(
            sanitizedData,
            platform,
            id,
            allowedBoothCategoryId
        )

        if (!processedItem) {
            // プラットフォーム処理が失敗した場合もoutdatedとして返す
            if (cachedData) {
                await markItemAsOutdated(id)
                consola.warn(`Item ${id} processing failed, marked as outdated`)
                return { ...cachedData, outdated: true }
            }

            throw new Error(`Failed to process item ${id}`)
        }

        // データベースの更新
        await updateDatabase(processedItem)

        return processedItem
    } catch (error) {
        consola.error(`Error processing item ${id}:`, error)
        return null
    }
}

const updateDatabase = async (item: Item): Promise<void> => {
    try {
        // ショップ情報の更新
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

        // アイテム情報の更新
        const itemForDb = {
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
            .values(itemForDb)
            .onConflictDoUpdate({
                target: items.id,
                set: {
                    ...itemForDb,
                    updatedAt: new Date(),
                    outdated: false,
                },
            })
    } catch (error) {
        consola.error(`Failed to update database for item ${item.id}:`, error)
        throw error
    }
}

const processItemByPlatform = async (
    data: Booth,
    platform: Platform,
    id: string,
    allowedBoothCategoryId: number[]
): Promise<Item | null> => {
    switch (platform) {
        case 'booth':
            return processBoothItem(data, id, allowedBoothCategoryId)
        default:
            throw new Error(`Platform ${platform} is not yet implemented`)
    }
}

const processBoothItem = (
    boothData: Booth,
    id: string,
    allowedBoothCategoryId: number[]
): Item | null => {
    // カテゴリチェック
    if (!allowedBoothCategoryId.includes(boothData.category.id)) {
        consola.warn(`Item ${id} category not allowed:`, boothData.category.id)
        return null
    }

    // 価格の決定（無料ダウンロードがある場合はFREE）
    const price = boothData.variations.some((v) => v.status === 'free_download')
        ? 'FREE'
        : boothData.price

    const category = mapCategoryToItemCategory(
        'booth',
        boothData.category.id,
        id
    )
    const imageUrl = boothData.images[0]?.original || ''

    return {
        id: boothData.id,
        platform: 'booth',
        category,
        name: boothData.name,
        image: imageUrl,
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

export default defineApi<Item>(
    async () => {
        try {
            const { id } = await validateParams(params)
            const { platform } = await validateQuery(query)
            const { allowedBoothCategoryId, forceUpdateItem } =
                await useEvent().$fetch('/api/edge-config')

            consola.log('Processing items:', id)
            consola.log('Platform:', platform || 'auto-detect from cache')

            const result = await processItem(
                id,
                platform,
                allowedBoothCategoryId,
                forceUpdateItem
            )

            if (!result) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Item not found or processing failed',
                })
            }

            consola.log(`Item ${id} processed successfully`)
            return result
        } catch (error) {
            consola.error('API handler error:', error)

            // エラーの種類に応じて適切なステータスコードを返す
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    throw createError({
                        statusCode: 404,
                        statusMessage: 'Item not found',
                    })
                }
                if (error.message.includes('Platform is required')) {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Platform parameter is required',
                    })
                }
            }

            throw createError({
                statusCode: 500,
                statusMessage: 'Internal server error',
            })
        }
    },
    {
        errorMessage: 'Failed to get items.',
    }
)
