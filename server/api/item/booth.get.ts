import { serverSupabaseClient } from '#supabase/server';
import type { H3Event } from 'h3';
import { z } from 'zod';

const requestQuerySchema = z.object({
    id: z.coerce
        .number({
            required_error: 'IDは必須です',
            invalid_type_error: 'IDは数値である必要があります',
        })
        .int('IDは整数である必要があります')
        .positive('IDは正の値である必要があります'),
});

export type RequestQuery = z.infer<typeof requestQuerySchema>;

interface fetchedItem extends Omit<Item, 'updated_at'> {
    tags: string[];
}

const logDuration = (startTime: number, source: string, itemName: string) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`Fetch Done : ${source} : ${duration}ms : ${itemName}`);
};

const GetBoothItem = async (event: H3Event, id: number): Promise<Item> => {
    const edgeConfig = await event.$fetch('/api/edge-config');
    if (!edgeConfig)
        throw createError({
            statusCode: 500,
            message: 'Error in vercel edge config.',
        });

    const client = await serverSupabaseClient<Database>(event);
    const startTime = Date.now(); // 処理開始時刻を記録

    const { data: itemData } = await client
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
        .maybeSingle();

    // データが存在し、かつ最終更新が1日以内ならそのまま返す
    // edge config の forceUpdateItem が true の場合は強制的に更新
    if (!edgeConfig.forceUpdateItem) {
        if (itemData) {
            const timeDifference =
                new Date().getTime() - new Date(itemData.updated_at).getTime();

            if (timeDifference < 24 * 60 * 60 * 1000) return itemData;

            console.log('Data is old, fetching from Booth', id);
        }
    } else console.log('Force update is enabled, fetching from Booth', id);

    const locale = 'ja';
    const urlBase = `https://booth.pm/${locale}/items/`;

    let response: Booth;
    try {
        response = await $fetch<Booth>(`${urlBase}${id}.json`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        });
    } catch {
        // Boothからの取得に失敗した場合、DBの outdated フラグを更新してエラーを返す
        const { data } = await client
            .from('items')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (data) {
            await client.from('items').update({ outdated: true }).eq('id', id);
            await client.rpc('update_item_updated_at', { item_id: id });
        }

        throw createError({
            statusCode: 503,
            message: 'Failed to fetch data from Booth',
        });
    }

    // カテゴリIDをチェック
    try {
        const allowedBoothCategoryId =
            edgeConfig.allowedBoothCategoryId as number[];

        if (!allowedBoothCategoryId.includes(Number(response.category.id)))
            if (
                !response.tags
                    .map((tag: { name: string }) => tag.name)
                    .includes('VRChat')
            )
                throw createError({
                    statusCode: 400,
                    message: 'Invalid category ID',
                });
    } catch (e) {
        console.log(e);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((e as any).statusCode) throw e;

        throw createError({
            statusCode: 500,
            message: 'Failed to get allowed tag data.',
        });
    }

    let price = response.price;
    for (const i of response.variations)
        if (i.status === 'free_download') {
            price = 'FREE';
            break;
        }

    let category: ItemCategory = 'other';

    const customCategory = specificItemCategory('booth', id);

    if (customCategory) category = customCategory;
    else {
        if (response.category.id === 208) category = 'avatar';
        else if (response.category.id === 209) category = 'cloth';
        else if (response.category.id === 217) category = 'accessory';
    }

    const item: fetchedItem = {
        id: Number(response.id),
        name: response.name.toString(),
        thumbnail: response.images[0].original.toString(),
        price: price,
        likes: Number(response.wish_lists_count),
        category: category,
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
    };

    const { data: insertShop, error: shopError } = await client
        .from('shops')
        .upsert({
            id: item.shop.id,
            name: item.shop.name,
            thumbnail: item.shop.thumbnail,
            verified: item.shop.verified,
        })
        .eq('id', item.shop.id)
        .select()
        .maybeSingle();

    if (shopError) {
        console.error('Error inserting shop:', shopError);
        throw createError({
            statusCode: 500,
            message: 'Failed to insert shop data.',
        });
    }

    const { data: insertItem, error: itemError } = await client
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
        .maybeSingle();

    if (itemError) {
        console.error('Error inserting item:', itemError);
        throw createError({
            statusCode: 500,
            message: 'Failed to insert item data.',
        });
    }

    if (!insertItem || !insertShop)
        throw createError({
            statusCode: 500,
            message: 'Failed to insert data.',
        });

    logDuration(startTime, 'Booth', item.name);

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
    };
};

export default defineEventHandler(async (event): Promise<Item> => {
    const rawQuery = getQuery(event);
    const result = requestQuerySchema.safeParse(rawQuery);

    if (!result.success)
        throw createError({
            statusCode: 400,
            message: `不正なリクエスト: ${result.error.issues.map((i) => i.message).join(', ')}`,
        });

    const { id } = result.data;

    return GetBoothItem(event, id);
});
