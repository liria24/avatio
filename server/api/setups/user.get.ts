import { serverSupabaseClient } from '#supabase/server';
import { z } from 'zod';

const requestQuerySchema = z.object({
    userId: z
        .string({
            required_error: 'User ID is required',
            invalid_type_error: 'User ID must be a string',
        })
        .min(1, 'User ID cannot be empty'),

    page: z.coerce
        .number({
            required_error: 'Page number is required',
            invalid_type_error: 'Page must be a number',
        })
        .int('Page must be an integer')
        .nonnegative('Page must be a non-negative number')
        .default(0),

    perPage: z.coerce
        .number({
            required_error: 'Items per page is required',
            invalid_type_error: 'Items per page must be a number',
        })
        .int('Items per page must be an integer')
        .positive('Items per page must be a positive number')
        .default(10),
});

export type RequestQuery = z.infer<typeof requestQuerySchema>;

interface SetupsResponse {
    setups: SetupClient[];
    hasMore: boolean;
}

export default defineEventHandler(async (event): Promise<SetupsResponse> => {
    const rawQuery = await getQuery(event);
    const result = requestQuerySchema.safeParse(rawQuery);

    if (!result.success) {
        throw createError({
            statusCode: 400,
            message: `Invalid request: ${result.error.issues.map((i) => i.message).join(', ')}`,
        });
    }

    const query = result.data;
    const supabase = await serverSupabaseClient<Database>(event);

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
        .overrideTypes<SetupDB[]>();

    if (!data || !count)
        throw createError({
            statusCode: 500,
            message: 'Failed to get setups.',
        });

    // 成功時は直接データを返す
    return {
        setups: data.map((setup) => setupMoldingClient(setup)),
        hasMore: count > query.page * query.perPage + query.perPage,
    };
});
