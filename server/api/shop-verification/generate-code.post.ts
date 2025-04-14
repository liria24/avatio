import crypto from 'crypto';
import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';

/**
 * セキュアなランダム文字列を生成する関数
 */
const generateSecureRandomString = (length: number): string => {
    return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

export default defineEventHandler(async (event): Promise<{ code: string }> => {
    try {
        const user = await serverSupabaseUser(event);

        if (!user?.id) {
            console.error('Error: ユーザーがログインしていません');
            throw createError({
                statusCode: 403,
                message: 'ログインが必要です',
            });
        }

        const supabase = await serverSupabaseServiceRole<Database>(event);

        // 既存のコードを確認・削除
        const { data: oldData, error: selectError } = await supabase
            .from('shop_verification')
            .select('code, user_id, created_at')
            .eq('user_id', user.id);

        if (selectError) {
            console.error('Error getting existing code:', selectError);
            throw createError({
                statusCode: 500,
                message: '既存コードの確認中にエラーが発生しました',
            });
        }

        // 既存のコードがあれば削除
        if (oldData?.length) {
            const { error: deleteError } = await supabase
                .from('shop_verification')
                .delete()
                .eq('user_id', user.id);

            if (deleteError)
                // 削除に失敗しても続行
                console.error('Error deleting old code:', deleteError);
        }

        // 新しいコードを生成
        const code = generateSecureRandomString(64);

        // コードをデータベースに保存
        const { data, error: insertError } = await supabase
            .from('shop_verification')
            .insert({
                code: code,
                user_id: user.id,
            })
            .select();

        if (insertError || !data) {
            console.error('Error inserting verification code:', insertError);
            throw createError({
                statusCode: 500,
                message: '認証コードの生成に失敗しました',
            });
        }

        // 成功時は201 Created（新しいリソース作成）
        setResponseStatus(event, 201);

        return {
            code: code,
        };
    } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (error && (error as any).statusCode) throw error;

        console.error('Unexpected error generating code:', error);
        throw createError({
            statusCode: 500,
            message: '予期せぬエラーが発生しました',
        });
    }
});
