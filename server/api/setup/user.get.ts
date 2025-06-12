import { z } from 'zod/v4'

const query = z.object({
    userId: z.string('User ID is required').min(1, 'User ID cannot be empty'),

    page: z.coerce
        .number('Page number is required')
        .int('Page must be an integer')
        .nonnegative('Page must be a non-negative number')
        .default(0),

    perPage: z.coerce
        .number('Items per page is required')
        .int('Items per page must be an integer')
        .positive('Items per page must be a positive number')
        .default(10),
})

interface SetupsResponse {
    setups: SetupClient[]
    hasMore: boolean
}

export default defineEventHandler(async (): Promise<SetupsResponse> => {
    const { page, perPage, userId } = await validateQuery(query)
    const supabase = await getSupabaseServerClient()

    const { data, error, count } = await supabase
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
        .eq('author', userId)
        .range(page * perPage, page * perPage + (perPage - 1))
        .order('created_at', { ascending: false })
        .overrideTypes<SetupDB[]>()

    if (error)
        throw createError({
            statusCode: 500,
            message: 'Failed to get setups.',
        })

    // 成功時は直接データを返す
    return {
        setups: data.map((setup) => setupMoldingClient(setup)),
        hasMore: (count ?? 0) > page * perPage + perPage,
    }
})
