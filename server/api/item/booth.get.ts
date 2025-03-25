import { serverSupabaseClient } from '#supabase/server';
import type { H3Event } from 'h3';

interface fetchedItem extends Omit<Item, 'updated_at'> {
    tags: string[];
}

const logDuration = (startTime: number, source: string, itemName: string) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`Fetch Done : ${source} : ${duration}ms : ${itemName}`);
};

const GetBoothItem = async (
    event: H3Event,
    id: number
): Promise<ApiResponse<Item>> => {
    const edgeConfig = await event.$fetch('/api/edge-config');
    if (!edgeConfig.value)
        return {
            data: null,
            error: {
                status: 500,
                message: 'Error in vercel edge config.',
            },
        };

    const config = edgeConfig.value;

    const client = await serverSupabaseClient(event);

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
    if (!config.forceUpdateItem) {
        if (itemData) {
            const timeDifference =
                new Date().getTime() - new Date(itemData.updated_at).getTime();

            if (timeDifference < 24 * 60 * 60 * 1000)
                return {
                    data: itemData,
                    error: null,
                };

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
        return {
            data: null,
            error: { status: 500, message: 'Failed to fetch data from Booth' },
        };
    }

    // カテゴリIDをチェック

    // 3Dモデル
    //      208 - 3Dキャラクター
    //      209 - 3D衣装
    //      217 - 3D装飾品
    //      210 - 3D小道具
    //      214 - 3Dテクスチャ
    //      215 - 3Dツール・システム
    //      216 - 3Dモーション・アニメーション
    //      211 - 3D環境・ワールド
    //      212 - VRoid
    //      127 - 3Dモデル（その他）
    // 素材データ
    //      125 - イラスト素材
    //      213 - イラスト3D素材
    //      126 - 背景画像
    //      128 - フォント・書体
    //      129 - アイコン
    //      22  - ロゴ
    //      123 - BGM素材
    //      124 - 効果音
    //      134 - 素材（その他）

    try {
        const allowedBoothCategoryId =
            config.allowedBoothCategoryId as number[];

        if (!allowedBoothCategoryId.includes(Number(response.category.id)))
            if (
                !response.tags
                    .map((tag: { name: string }) => tag.name)
                    .includes('VRChat')
            )
                return {
                    data: null,
                    error: { status: 400, message: 'Invalid category ID' },
                };
    } catch (e) {
        console.log(e);
        return {
            data: null,
            error: {
                status: 500,
                message: 'Failed to get allowed tag data.',
            },
        };
    }

    let price = response.price;
    for (const i of response.variations)
        if (i.status === 'free_download') {
            price = 'FREE';
            break;
        }

    let category: ItemCategory = 'other';

    // if (response.category.id === 208) category = 'avatar';
    // else if (response.category.id === 209) category = 'cloth';
    // else if (response.category.id === 217) category = 'accessory';

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

    const { data: insertShop } = await client
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

    const { data: insertItem } = await client
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

    if (!insertItem || !insertShop)
        return {
            data: null,
            error: { status: 500, message: 'Failed to insert data.' },
        };

    logDuration(startTime, 'Booth', item.name);

    return {
        data: {
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
        },
        error: null,
    };
};

export default defineEventHandler(async (event): Promise<ApiResponse<Item>> => {
    const query = getQuery(event);
    const id = Number(query.id);

    if (typeof id === 'number') return GetBoothItem(event, Number(id));
    else
        return {
            data: null,
            error: { status: 400, message: 'No ID or URL provided' },
        };
});
