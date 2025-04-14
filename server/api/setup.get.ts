import { serverSupabaseClient } from '#supabase/server';
import { z } from 'zod';

const requestQuerySchema = z.object({
    id: z.coerce
        .number({
            required_error: 'idは必須です',
            invalid_type_error: 'idは数値である必要があります',
        })
        .positive('idは正の数である必要があります'),
});

export type RequestQuery = z.infer<typeof requestQuerySchema>;

export default defineEventHandler(async (event): Promise<SetupClient> => {
    const rawQuery = await getQuery(event);
    const result = requestQuerySchema.safeParse(rawQuery);

    if (!result.success)
        throw createError({
            statusCode: 400,
            message: `不正なリクエスト: ${result.error.format()}`,
        });

    const query = result.data;
    const supabase = await serverSupabaseClient<Database>(event);

    const { data } = await supabase
        .from('setups')
        .select(
            `
                id,
                created_at,
                name,
                description,
                unity,
                author(
                    id,
                    name,
                    avatar,
                    badges:user_badges(
                        created_at,
                        name
                    )
                ),
                images:setup_images(
                    name,
                    width,
                    height
                ),
                items:setup_items(
                    data:item_id(
                        id,
                        updated_at,
                        outdated,
                        category,
                        name,
                        thumbnail,
                        price,
                        likes,
                        shop:shop_id(
                            id,
                            name,
                            thumbnail,
                            verified
                        ),
                        nsfw,
                        source
                    ),
                    note,
                    unsupported,
                    category,
                    shapekeys:setup_item_shapekeys(
                        name,
                        value
                    )
                ),
                tags:setup_tags(tag),
                co_authors:setup_coauthors(
                    user:user_id(
                        id,
                        name,
                        avatar,
                        badges:user_badges(
                            created_at,
                            name
                        )
                    ),
                    note
                )
                `
        )
        .eq('id', query.id)
        .maybeSingle<SetupDB>();

    if (!data)
        throw createError({
            statusCode: 404,
            message: 'Setup not found.',
        });

    // アイテム情報の更新処理
    if (data.items) {
        const currentTime = new Date().getTime();

        for (const item of data.items) {
            if (item.data) {
                const updatedAt = new Date(item.data.updated_at).getTime();
                const timeDifference = currentTime - updatedAt;

                // 時間の差分が1日を超えている場合、情報を更新
                if (timeDifference > 24 * 60 * 60 * 1000) {
                    try {
                        // boothアイテム情報を取得
                        const response = await event.$fetch('/api/item/booth', {
                            query: { id: item.data.id },
                        });

                        if (response)
                            // 取得したデータでアイテム情報を更新
                            item.data = {
                                ...response,
                                // 元の情報を保持
                                updated_at: new Date().toISOString(),
                            };
                        else
                            // 情報取得できなかった場合はoutdatedフラグを立てる
                            item.data.outdated = true;
                    } catch (error) {
                        console.error(
                            `Failed to update item ${item.data.id}:`,
                            error
                        );
                    }
                }
            }
        }
    }

    return setupMoldingClient(data);
});
