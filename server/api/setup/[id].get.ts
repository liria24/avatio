import { serverSupabaseClient } from '#supabase/server';
import { z } from 'zod';

export default defineEventHandler(async (event): Promise<SetupClient> => {
    const id = getRouterParam(event, 'id');

    const idSchema = z
        .string({
            required_error: 'ID is required',
            invalid_type_error: 'ID must be a string',
        })
        .refine(
            (val) =>
                !isNaN(Number(val)) &&
                Number(val) > 0 &&
                Number.isInteger(Number(val)),
            { message: 'ID must be a positive integer' }
        );

    try {
        idSchema.parse(id);
    } catch (error) {
        console.error('Invalid ID:', error);
        throw createError({
            statusCode: 400,
            message:
                error instanceof z.ZodError
                    ? `Invalid request: ${error.errors[0]?.message || 'Invalid ID'}`
                    : 'Invalid request: Invalid ID',
        });
    }

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
            og_image:setup_og_image(
                image,
                position_x,
                position_y,
                width
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
        .eq('id', Number(id)!)
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
