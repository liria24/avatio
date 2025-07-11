import { z } from 'zod/v4'

const query = z.object({
    page: z.coerce
        .number('Page number must be a number')
        .int('Page number must be an integer')
        .nonnegative('Page number must be 0 or greater')
        .default(0),

    perPage: z.coerce
        .number('Items per page must be a number')
        .int('Items per page must be an integer')
        .positive('Items per page must be a positive number')
        .default(10),
})

interface BookmarksResponse {
    setups: SetupClient[]
    hasMore: boolean
}

export default defineEventHandler(async (): Promise<BookmarksResponse> => {
    try {
        await checkSupabaseUser()

        const { page, perPage } = await validateQuery(query)
        const supabase = await getSupabaseServerClient()

        const { data, error, count } = await supabase
            .from('bookmarks')
            .select(
                `
                post(
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
                )
                `,
                { count: 'estimated' }
            )
            .range(page * perPage, page * perPage + (perPage - 1))
            .order('created_at', { ascending: false })
            .throwOnError()
            .overrideTypes<{ post: SetupDB }[]>()

        if (error) {
            console.error(
                'Data retrieval error: Failed to get data or count from bookmarks table.'
            )
            throw createError({
                statusCode: 500,
                message: 'Failed to get setups.',
            })
        }

        return {
            setups: data
                .filter((post) => post.post)
                .map((post) => post.post)
                .map((setup) => setupMoldingClient(setup)),
            hasMore: (count ?? 0) > page * perPage + perPage,
        }
    } catch (error) {
        console.error('Error occurred while fetching bookmarks:', error)
        throw createError({
            statusCode: 500,
            message: 'Failed to get bookmarks.',
        })
    }
})
