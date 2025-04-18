import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';
import { z } from 'zod';

const requestBodySchema = z.object({
    shopId: z
        .string({
            required_error: 'ショップIDは必須です',
            invalid_type_error: 'ショップIDは文字列である必要があります',
        })
        .min(1, 'ショップIDは空にできません'),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

export default defineEventHandler(async (event) => {
    const rawBody = await readBody(event);
    const result = requestBodySchema.safeParse(rawBody);

    if (!result.success)
        throw createError({
            statusCode: 400,
            message: `不正なリクエスト: ${result.error.issues.map((i) => i.message).join(', ')}`,
        });

    const { shopId } = result.data;

    // ユーザー認証チェック
    const user = await serverSupabaseUser(event).catch(() => null);
    if (!user?.id)
        throw createError({
            statusCode: 403,
            message: 'ログインが必要です',
        });

    const supabase = await serverSupabaseServiceRole<Database>(event);

    // ユーザーのショップ関連付け削除
    const { data, error: deleteError } = await supabase
        .from('user_shops')
        .delete()
        .eq('user_id', user.id)
        .eq('shop_id', shopId)
        .select()
        .maybeSingle();

    if (deleteError) {
        console.error('Error deleting user shop:', deleteError);
        throw createError({
            statusCode: 500,
            message: 'ショップ関連付けの削除中にエラーが発生しました',
        });
    }

    if (!data)
        throw createError({
            statusCode: 404,
            message:
                'ショップが見つからないか、あなたの所有するショップではありません',
        });

    try {
        // ユーザーの他のショップをチェック
        const { data: userShops, error: selectError } = await supabase
            .from('user_shops')
            .select('id')
            .eq('user_id', user.id);

        if (selectError) {
            console.error('Error checking user shops:', selectError);
            throw createError({
                statusCode: 500,
                message: 'ユーザーのショップ情報の取得に失敗しました',
            });
        }

        // 他のショップがなければバッジも削除
        if (!userShops?.length) {
            const { error: badgeError } = await supabase
                .from('user_badges')
                .delete()
                .eq('user_id', user.id)
                .eq('name', 'shop_owner');

            if (badgeError)
                // バッジの削除に失敗してもプロセスは続行
                console.error('Error removing shop owner badge:', badgeError);
        }

        // 成功時は204 No Content
        setResponseStatus(event, 204);
        return null;
    } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (error && (error as any).statusCode) throw error;

        console.error('Unexpected error in unverify:', error);
        throw createError({
            statusCode: 500,
            message: '予期せぬエラーが発生しました',
        });
    }
});
