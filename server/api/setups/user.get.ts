import { serverSupabaseClient } from '#supabase/server';

interface RequestQuery {
    userId: string;
    page: number;
    perPage: number;
}

export default defineEventHandler(
    async (
        event
    ): Promise<ApiResponse<{ setups: SetupClient[]; hasMore: boolean }>> => {
        const query: RequestQuery = await getQuery(event);

        const supabase = await serverSupabaseClient(event);

        const { data, count } = await supabase
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
                    user:users(
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
                `,
                { count: 'estimated' }
            )
            .eq('author', query.userId)
            .range(
                query.page * query.perPage,
                query.page * query.perPage + (query.perPage - 1)
            )
            .order('created_at', { ascending: false })
            .returns<SetupDB[]>();

        if (!data || !count)
            return {
                data: null,
                error: {
                    status: 500,
                    message: 'Failed to get setups.',
                },
            };

        return {
            data: {
                setups: data.map((setup) => setupMoldingClient(setup)),
                hasMore: count > query.page * query.perPage + query.perPage,
            },
            error: null,
        };
    }
);
