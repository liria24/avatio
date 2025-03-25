import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';

interface Body {
    shopId: string;
}

interface UnverifyResponse {
    success: boolean;
    error?: string;
}

export default defineEventHandler(async (event): Promise<UnverifyResponse> => {
    try {
        const { shopId } = await readBody<Body>(event);

        // shopIdの検証
        if (!shopId || typeof shopId !== 'string' || !shopId.trim())
            return {
                success: false,
                error: 'ショップIDは必須です',
            };

        const user = await serverSupabaseUser(event);
        if (!user?.id)
            return {
                success: false,
                error: 'ログインが必要です',
            };

        const supabase = await serverSupabaseServiceRole(event);

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
            return {
                success: false,
                error: 'ショップ関連付けの削除中にエラーが発生しました',
            };
        }

        if (!data)
            return {
                success: false,
                error: 'ショップが見つからないか、あなたの所有するショップではありません',
            };

        // ユーザーの他のショップをチェック
        const { data: userShops, error: selectError } = await supabase
            .from('user_shops')
            .select('id')
            .eq('user_id', user.id);

        if (selectError) {
            console.error('Error checking user shops:', selectError);
            return {
                success: false,
                error: 'ユーザーのショップ情報の取得に失敗しました',
            };
        }

        // 他のショップがなければバッジも削除
        if (!userShops?.length) {
            const { error: badgeError } = await supabase
                .from('user_badges')
                .delete()
                .eq('user_id', user.id)
                .eq('name', 'shop_owner');

            if (badgeError) {
                console.error('Error removing shop owner badge:', badgeError);
                // バッジの削除に失敗してもプロセスは続行
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Unexpected error in unverify:', error);
        return {
            success: false,
            error: '予期せぬエラーが発生しました',
        };
    }
});
