import { serverSupabaseClient } from '#supabase/server';

export interface RequestQuery {
    id: number;
}

export default defineEventHandler(async (event): Promise<SetupClient> => {
    const query: RequestQuery = await getQuery(event);

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
        .eq('id', Number(query.id))
        .maybeSingle<SetupDB>();

    if (!data)
        throw createError({
            statusCode: 404,
            message: 'Setup not found.',
        });

    return setupMoldingClient(data);
});
