import database from '@@/database'
import { items, shops } from '@@/database/schema'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const fetchFromBooth = async (id: number) => {
    const locale = 'ja'
    const urlBase = `https://booth.pm/${locale}/items/`
    try {
        return await $fetch<Booth>(`${urlBase}${id}.json`, {
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })
    } catch (error) {
        consola.error(`Failed to fetch item ${id} from Booth:`, error)
        return null
    }
}

const specificItemCategory = (id: number): ItemCategory | null => {
    const categoryMap: Record<number, ItemCategory> = {
        3087170: 'shader', // lilToon
        4841309: 'shader', // Poiyomi
    }
    return categoryMap[id] || null
}

const mapBoothCategoryToItemCategory = (
    categoryId: number,
    itemId: number
): ItemCategory => {
    const specificCategory = specificItemCategory(itemId)
    if (specificCategory) return specificCategory

    const categoryMap: Record<number, ItemCategory> = {
        208: 'avatar',
        209: 'clothing',
        217: 'accessory',
    }

    return categoryMap[categoryId] || 'other'
}

export default defineApi<Item>(
    async () => {
        const { id } = await validateParams(params)
        const { allowedBoothCategoryId, forceUpdateItem } =
            await useEvent().$fetch('/api/edge-config')

        // forceUpdateItemがtrueでない場合のみDBからチェック
        if (!forceUpdateItem) {
            const data = await database.query.items.findFirst({
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

            if (data && !data.outdated) {
                const timeDifference =
                    new Date().getTime() - new Date(data.updatedAt).getTime()

                // 24時間以内かつoutdatedでない場合はキャッシュを返す
                if (timeDifference < 24 * 60 * 60 * 1000) return data
            }
        }

        consola.log('Fetching item data from Booth:', id)

        const boothData = await fetchFromBooth(id)

        if (!boothData) {
            // DBにデータが存在する場合のみoutdatedを更新
            await database
                .update(items)
                .set({ outdated: true })
                .where(eq(items.id, id))

            throw createError({
                statusCode: 404,
                statusMessage: 'Item not found.',
            })
        }

        if (!allowedBoothCategoryId.includes(boothData.category.id)) {
            throw createError({
                statusCode: 402,
                statusMessage: 'Item not allowed.',
            })
        }

        const price = boothData.variations.some(
            (v) => v.status === 'free_download'
        )
            ? 'FREE'
            : boothData.price

        const category = mapBoothCategoryToItemCategory(
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
            platform: 'booth' as Platform,
            shopId: boothData.shop.subdomain,
        }

        // ショップ情報の更新
        await database
            .insert(shops)
            .values({
                id: boothData.shop.subdomain,
                platform: 'booth',
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
            platform: 'booth' as Platform,
            category,
            name: boothData.name,
            image: boothData.images[0]?.original || '',
            price,
            likes: Number(boothData.wish_lists_count) || 0,
            nsfw: Boolean(boothData.is_adult),
            shop: {
                id: boothData.shop.subdomain,
                platform: 'booth' as Platform,
                name: boothData.shop.name,
                image: boothData.shop.thumbnail_url || '',
                verified: Boolean(boothData.shop.verified),
            },
        }
    },
    {
        errorMessage: 'Failed to get item.',
    }
)
