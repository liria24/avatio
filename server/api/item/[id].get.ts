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

const fetchItem = async (id: string, platform: Platform) => {
    const urls = {
        booth: `https://booth.pm/ja/items/${id}.json`,
        // 他のプラットフォームのURLをここに追加可能
    }

    try {
        if (platform === 'booth') {
            return await $fetch<Booth>(`${urls['booth']}`, {
                headers: {
                    Accept: 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                },
            })
        }
        // 他のプラットフォームの処理をここに追加可能
        else {
            consola.error(`Unsupported platform: ${platform}`)
            return null
        }
    } catch (error) {
        consola.error(`Failed to fetch item ${id} from ${platform}:`, error)
        return null
    }
}

const specificItemCategory = (id: string): ItemCategory | null => {
    const categoryMap: Record<string, ItemCategory> = {
        3087170: 'shader', // lilToon
        4841309: 'shader', // Poiyomi
    }
    return categoryMap[id] || null
}

const mapCategoryToItemCategory = (
    platform: Platform,
    categoryId: number,
    itemId: string
): ItemCategory => {
    const specificCategory = specificItemCategory(itemId)
    if (specificCategory) return specificCategory

    // プラットフォーム別のカテゴリマッピング
    const platformCategoryMaps: Record<
        Platform,
        Record<number, ItemCategory>
    > = {
        booth: {
            208: 'avatar',
            209: 'clothing',
            217: 'accessory',
        },
        // 他のプラットフォームのカテゴリマッピングをここに追加可能
    }

    const categoryMap = platformCategoryMaps[platform] || {}
    return categoryMap[categoryId] || 'other'
}

const processItem = async (
    id: string,
    platform: Platform | undefined,
    allowedBoothCategoryId: number[],
    forceUpdate: boolean
): Promise<Item | null> => {
    try {
        // forceUpdateItemがtrueでない場合のみDBからチェック
        if (!forceUpdate) {
            const cachedData = await database.query.items.findFirst({
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
            })

            if (cachedData && !cachedData.outdated) {
                const timeDifference =
                    new Date().getTime() -
                    new Date(cachedData.updatedAt).getTime()

                // 24時間以内かつoutdatedでない場合はキャッシュを返す
                if (timeDifference < 24 * 60 * 60 * 1000) return cachedData
            }

            // キャッシュデータが存在する場合はそのプラットフォーム情報を使用
            if (cachedData) {
                platform = cachedData.platform
            }
        }

        // platformが未定義の場合はエラー
        if (!platform) {
            consola.error(
                `Platform is required for item ${id} when no cached data exists`
            )
            return null
        }

        consola.log(`Fetching item data from ${platform}:`, id)

        // 現在はboothのみ実装
        if (platform !== 'booth') {
            consola.error(`Platform ${platform} is not yet implemented`)
            return null
        }

        const boothData = await fetchItem(id, platform)

        if (!boothData) {
            // DBにデータが存在する場合のみoutdatedを更新
            await database
                .update(items)
                .set({ outdated: true })
                .where(eq(items.id, id))

            return null
        }

        if (!allowedBoothCategoryId.includes(boothData.category.id)) {
            consola.warn(
                `Item ${id} category not allowed:`,
                boothData.category.id
            )
            return null
        }

        const price = boothData.variations.some(
            (v) => v.status === 'free_download'
        )
            ? 'FREE'
            : boothData.price

        const category = mapCategoryToItemCategory(
            platform,
            boothData.category.id,
            id
        )

        const item = {
            id: boothData.id,
            name: boothData.name,
            image: boothData.images[0]?.original || '',
            category,
            price,
            likes: Number(boothData.wish_lists_count) || 0,
            nsfw: Boolean(boothData.is_adult),
            platform,
            shopId: boothData.shop.subdomain,
        }

        // ショップ情報の更新
        await database
            .insert(shops)
            .values({
                id: boothData.shop.subdomain,
                platform,
                name: boothData.shop.name,
                image: boothData.shop.thumbnail_url || '',
                verified: Boolean(boothData.shop.verified),
            })
            .onConflictDoUpdate({
                target: shops.id,
                set: {
                    name: boothData.shop.name,
                    image: boothData.shop.thumbnail_url || '',
                    verified: Boolean(boothData.shop.verified),
                },
            })

        // アイテム情報の更新
        await database
            .insert(items)
            .values(item)
            .onConflictDoUpdate({
                target: items.id,
                set: {
                    ...item,
                    updatedAt: new Date(),
                    outdated: false,
                },
            })

        return {
            id: boothData.id,
            platform,
            category,
            name: boothData.name,
            image: boothData.images[0]?.original || '',
            price,
            likes: Number(boothData.wish_lists_count) || 0,
            nsfw: Boolean(boothData.is_adult),
            shop: {
                id: boothData.shop.subdomain,
                platform,
                name: boothData.shop.name,
                image: boothData.shop.thumbnail_url || '',
                verified: Boolean(boothData.shop.verified),
            },
        }
    } catch (error) {
        consola.error(`Error processing item ${id}:`, error)
        return null
    }
}

export default defineApi<Item>(
    async () => {
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
            consola.warn(`Item ${id} not found or processing failed`)
            throw createError({
                statusCode: 404,
                statusMessage: 'Item not found',
            })
        }

        consola.log(`Item ${id} processed successfully`)
        return result
    },
    {
        errorMessage: 'Failed to get items.',
        ratelimit: true,
    }
)
