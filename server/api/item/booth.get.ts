import { z } from 'zod/v4'

const query = z.object({
    id: z.coerce
        .number('ID is required')
        .int('ID must be an integer')
        .positive('ID must be positive'),
})

interface fetchedItem extends Omit<Item, 'updated_at'> {
    tags: string[]
}

const logDuration = (startTime: number, source: string, itemName: string) => {
    const endTime = Date.now()
    const duration = endTime - startTime
    console.log(`Fetch Done : ${source} : ${duration}ms : ${itemName}`)
}

export default defineEventHandler(async (): Promise<Item> => {
    const { id } = await validateQuery(query)

    const edgeConfig = await useEvent().$fetch('/api/edge-config')
    if (!edgeConfig) {
        console.error('Failed to fetch edge config')
        throw createError({
            statusCode: 500,
            message: 'Error in vercel edge config.',
        })
    }

    const supabase = await getSupabaseServerClient()
    const startTime = Date.now() // 処理開始時刻を記録

    const { data: itemData } = await supabase
        .from('items')
        .select(
            `
            id,
            updated_at,
            name,
            thumbnail,
            price,
            category,
            shop:shop_id(
                id,
                name,
                thumbnail,
                verified
            ),
            likes,
            nsfw,
            outdated,
            source
            `
        )
        .eq('id', id)
        .maybeSingle()

    // データが存在し、かつ最終更新が1日以内ならそのまま返す
    // edge config の forceUpdateItem が true の場合は強制的に更新
    if (!edgeConfig.forceUpdateItem && itemData) {
        const timeDifference =
            new Date().getTime() - new Date(itemData.updated_at).getTime()

        if (timeDifference < 24 * 60 * 60 * 1000) return itemData

        console.log('Data is old, fetching from Booth', id)
    } else if (edgeConfig.forceUpdateItem) {
        console.log('Force update is enabled, fetching from Booth', id)
    }

    const locale = 'ja'
    const urlBase = `https://booth.pm/${locale}/items/`

    let response: Booth
    try {
        response = await $fetch<Booth>(`${urlBase}${id}.json`, {
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })
    } catch (error) {
        console.error(`Failed to fetch data from Booth for item ${id}:`, error)
        // Boothからの取得に失敗した場合、DBの outdated フラグを更新してエラーを返す
        const { data } = await supabase
            .from('items')
            .select('id')
            .eq('id', id)
            .maybeSingle()

        if (data) {
            await supabase.from('items').update({ outdated: true }).eq('id', id)
            await supabase.rpc('update_item_updated_at', { item_id: id })
        }

        throw createError({
            statusCode: 503,
            message: 'Failed to fetch data from Booth',
        })
    }

    // カテゴリIDをチェック
    try {
        const allowedBoothCategoryId =
            edgeConfig.allowedBoothCategoryId as number[]
        const isVRChatTag = response.tags.some(
            (tag: { name: string }) => tag.name === 'VRChat'
        )

        if (
            !allowedBoothCategoryId.includes(Number(response.category.id)) &&
            !isVRChatTag
        ) {
            console.error(`Invalid category ID: ${response.category.id}`)
            throw createError({
                statusCode: 400,
                message: 'Invalid category ID',
            })
        }
    } catch (e) {
        console.error('Error checking category:', e)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((e as any).statusCode) throw e

        throw createError({
            statusCode: 500,
            message: 'Failed to get allowed tag data.',
        })
    }

    let price = response.price
    for (const i of response.variations)
        if (i.status === 'free_download') {
            price = 'FREE'
            break
        }

    let category: ItemCategory = 'other'
    const customCategory = specificItemCategory('booth', id)

    if (customCategory) category = customCategory
    else if (response.category.id === 208) category = 'avatar'
    else if (response.category.id === 209) category = 'cloth'
    else if (response.category.id === 217) category = 'accessory'

    const item: fetchedItem = {
        id: Number(response.id),
        name: response.name.toString(),
        thumbnail: response.images[0].original.toString(),
        price,
        likes: Number(response.wish_lists_count),
        category,
        shop: {
            name: response.shop.name.toString(),
            id: response.shop.subdomain.toString(),
            thumbnail: response.shop.thumbnail_url.toString(),
            verified: Boolean(response.shop.verified),
        },
        nsfw: Boolean(response.is_adult),
        tags: response.tags.map((tag: { name: string }) => tag.name),
        outdated: false,
        source: 'booth',
    }

    // 商品と店舗情報をDBに保存
    try {
        const { data: insertShop, error: shopError } = await supabase
            .from('shops')
            .upsert({
                id: item.shop.id,
                name: item.shop.name,
                thumbnail: item.shop.thumbnail,
                verified: item.shop.verified,
            })
            .eq('id', item.shop.id)
            .select()
            .maybeSingle()

        if (shopError) {
            console.error('Error inserting shop:', shopError)
            throw createError({
                statusCode: 500,
                message: 'Failed to insert shop data.',
            })
        }

        const { data: insertItem, error: itemError } = await supabase
            .from('items')
            .upsert({
                id: item.id,
                name: item.name,
                thumbnail: item.thumbnail,
                price: item.price,
                likes: item.likes,
                category: item.category,
                shop_id: item.shop.id,
                nsfw: item.nsfw,
                outdated: false,
                source: 'booth',
            })
            .eq('id', id)
            .select()
            .maybeSingle()

        if (itemError) {
            console.error('Error inserting item:', itemError)
            throw createError({
                statusCode: 500,
                message: 'Failed to insert item data.',
            })
        }

        if (!insertItem || !insertShop) {
            console.error('No data returned after insert')
            throw createError({
                statusCode: 500,
                message: 'Failed to insert data.',
            })
        }

        logDuration(startTime, 'Booth', item.name)

        return {
            id: insertItem.id,
            updated_at: insertItem.updated_at,
            category: insertItem.category,
            name: insertItem.name,
            thumbnail: insertItem.thumbnail,
            price: insertItem.price,
            likes: insertItem.likes,
            shop: {
                name: insertShop.name,
                id: insertShop.id,
                thumbnail: insertShop.thumbnail,
                verified: insertShop.verified,
            },
            nsfw: insertItem.nsfw,
            outdated: false,
            source: 'booth',
        }
    } catch (error) {
        console.error('Error saving data:', error)
        throw error
    }
})
