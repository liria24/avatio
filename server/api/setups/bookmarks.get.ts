import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';

const requestQuerySchema = z.object({
    page: z.coerce
        .number({
            invalid_type_error: 'ページ番号は数値である必要があります',
        })
        .int('ページ番号は整数である必要があります')
        .nonnegative('ページ番号は0以上である必要があります')
        .default(0),

    perPage: z.coerce
        .number({
            invalid_type_error: '1ページあたりの件数は数値である必要があります',
        })
        .int('1ページあたりの件数は整数である必要があります')
        .positive('1ページあたりの件数は正の数である必要があります')
        .default(10),
});

export type RequestQuery = z.infer<typeof requestQuerySchema>;

interface BookmarksResponse {
    setups: SetupClient[];
    hasMore: boolean;
}

export default defineEventHandler(async (event): Promise<BookmarksResponse> => {
    try {
        const user = await serverSupabaseUser(event);
        if (!user) {
            console.error('認証エラー: ユーザーが見つかりません');
            throw createError({
                statusCode: 403,
                message: 'Forbidden.',
            });
        }

        const rawQuery = await getQuery(event);
        const result = requestQuerySchema.safeParse(rawQuery);

        if (!result.success) {
            const errorMessage = result.error.issues
                .map((i) => i.message)
                .join(', ');
            console.error(
                'クエリパラメータバリデーションエラー:',
                errorMessage
            );
            throw createError({
                statusCode: 400,
                message: `不正なリクエスト: ${errorMessage}`,
            });
        }

        const query = result.data;
        const supabase = await serverSupabaseClient<Database>(event);

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
            .range(
                query.page * query.perPage,
                query.page * query.perPage + (query.perPage - 1)
            )
            .order('created_at', { ascending: false })
            .throwOnError()
            .overrideTypes<{ post: SetupDB }[]>();

        if (error) {
            console.error(
                'データ取得エラー: データまたはカウントが取得できませんでした'
            );
            throw createError({
                statusCode: 500,
                message: 'Failed to get setups.',
            });
        }

        return {
            setups: data
                .filter((post) => post.post)
                .map((post) => post.post)
                .map((setup) => setupMoldingClient(setup)),
            hasMore: (count ?? 0) > query.page * query.perPage + query.perPage,
        };
    } catch (error) {
        console.error('ブックマークの取得中にエラーが発生しました:', error);
        throw createError({
            statusCode: 500,
            message: 'Failed to get bookmarks.',
        });
    }
});
