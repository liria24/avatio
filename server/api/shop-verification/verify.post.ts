import { load, type CheerioAPI } from 'cheerio';
import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';
import type { H3Event } from 'h3';

// レスポンス型の定義
interface VerificationResponse {
    url: string;
    verified: boolean;
    error: boolean;
    message?: string;
}

// ショップ情報の型定義
interface ShopInfo {
    id: string;
    name: string;
    thumbnail: string | null;
    description: string;
}

/**
 * BOOTHショップ認証APIエンドポイント
 *
 * 処理の流れ:
 * 1. ユーザーログインの確認
 * 2. 送信されたURLの検証
 * 3. 既存の認証チェック
 * 4. ショップページの取得と解析
 * 5. 認証コードの検証
 * 6. ショップデータの登録・更新
 * 7. ユーザーとショップの関連付け
 * 8. バッジの付与
 */
export default defineEventHandler(
    async (event): Promise<VerificationResponse> => {
        // リクエストボディからURLを取得
        const body = await readBody<{ url: string }>(event);
        const { url } = body;

        if (!url) return createErrorResponse(url, 'URLが必要です');

        // ステップ1: ユーザーログインの確認
        const user = await serverSupabaseUser(event);
        if (!user) {
            console.error('Error: Needs login');
            return createErrorResponse(url, 'ログインが必要です');
        }

        const supabase = await serverSupabaseServiceRole(event);

        try {
            // ステップ2: URLのバリデーションと解析
            let destinationUrl: URL;
            try {
                destinationUrl = new URL(url.toString());
                // BOOTHのURLのみ許可
                if (!destinationUrl.hostname.endsWith('.booth.pm')) {
                    throw new Error('BOOTHのURLのみ認証できます');
                }
            } catch (e) {
                throw new Error(
                    '不正なURL形式です: ' +
                        (e instanceof Error ? e.message : '')
                );
            }

            const baseUrl = `${destinationUrl.origin}${destinationUrl.pathname}`;
            const subDomain = boothSubDomain(url.toString());

            if (!subDomain || subDomain.length < 2) {
                throw new Error('有効なBOOTHショップURLではありません');
            }

            // ステップ3: 既存の認証チェック
            const { data: existingUserShop, error: selectError } =
                await supabase
                    .from('user_shops')
                    .select('user_id, shop_id')
                    .eq('user_id', user.id)
                    .eq('shop_id', subDomain);

            if (selectError) {
                console.error('Error selecting user shop:', selectError);
                throw new Error('ユーザーショップ情報の取得に失敗しました');
            }

            if (existingUserShop?.length) {
                console.log('Already verified', subDomain, user.id);
                return {
                    url,
                    verified: true,
                    error: false,
                    message: '既に認証済みです',
                };
            }

            // ステップ4: ショップページの取得と解析
            const shop = await fetchAndParseShopInfo(baseUrl, subDomain);

            // ステップ5: 認証コードの検証
            await verifyAuthenticationCode(event, user.id, shop);

            // ステップ6-8: トランザクション的に処理
            await performDatabaseOperations(event, user.id, shop);

            // 認証成功
            return {
                url,
                verified: true,
                error: false,
                message: 'ショップの認証に成功しました',
            };
        } catch (error) {
            // エラーハンドリング
            console.error('Error on verification:', error);
            return createErrorResponse(
                url,
                error instanceof Error
                    ? error.message
                    : '認証処理中にエラーが発生しました'
            );
        }
    }
);

/**
 * エラーレスポンスを生成する関数
 */
const createErrorResponse = (
    url: string,
    message: string
): VerificationResponse => {
    return {
        url,
        verified: false,
        error: true,
        message,
    };
};

/**
 * ショップ情報を取得して解析する関数
 */
const fetchAndParseShopInfo = async (
    baseUrl: string,
    subDomain: string
): Promise<ShopInfo> => {
    let html: string;
    try {
        html = await $fetch<string>(baseUrl, {
            responseType: 'text',
            timeout: 30000, // 30秒のタイムアウト
        });
    } catch (error) {
        console.error('Failed to fetch shop URL:', error);
        throw new Error('ショップURLへのアクセスに失敗しました');
    }

    const $ = load(html);

    return {
        id: subDomain,
        name: extractShopName($),
        thumbnail: extractShopThumbnail($),
        description: extractShopDescription($),
    };
};

/**
 * ショップ名を抽出する関数
 */
const extractShopName = ($: CheerioAPI): string => {
    let title = $('span.shop-name-label').text().trim();

    if (!title?.length)
        title = $('title')
            .text()
            .trim()
            .replace(/ - BOOTH$/, '');

    return title || 'Unknown Shop';
};

/**
 * ショップサムネイルを抽出する関数
 */
const extractShopThumbnail = ($: CheerioAPI): string | null => {
    return (
        $('div.avatar-image')
            .attr('style')
            ?.replace(/.*url\((.*?)\).*/, '$1') || null
    );
};

/**
 * ショップ説明文を抽出する関数
 */
const extractShopDescription = ($: CheerioAPI): string => {
    let description = $('div.description').text().trim();

    if (!description?.length)
        description = $('meta[name="description"]').attr('content') || '';

    if (!description)
        description =
            $('meta[property="og:description"]').attr('content') || '';

    return description;
};

/**
 * 認証コードを検証する関数
 */
const verifyAuthenticationCode = async (
    event: H3Event,
    userId: string,
    shop: ShopInfo
): Promise<void> => {
    const supabase = await serverSupabaseServiceRole(event);

    // 5.1: データベースから認証コードを取得
    const { data: codeData, error: codeError } = await supabase
        .from('shop_verification')
        .select('code, user_id, created_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (codeError) {
        console.error('Error fetching verification code:', codeError);
        throw new Error('認証コードの取得に失敗しました');
    }

    if (!codeData?.code)
        throw new Error('ログインユーザーの認証コードが見つかりません');

    // 5.2: 認証コードの有効期限チェック (10分以内)
    const TEN_MINUTES_MS = 1000 * 60 * 10;
    const codeCreatedAt = new Date(codeData.created_at);
    const codeExpiresAt = new Date(codeCreatedAt.getTime() + TEN_MINUTES_MS);

    if (new Date() > codeExpiresAt) {
        await supabase.from('shop_verification').delete().eq('user_id', userId);

        throw new Error(
            '認証コードの有効期限が切れました。新しいコードを生成してください'
        );
    }

    // 5.3: ショップ説明文に認証コードが含まれているか確認
    if (!shop.description)
        throw new Error('ショップの説明文を取得できませんでした');

    if (!shop.description.includes(codeData.code))
        throw new Error('ショップの説明文に認証コードが見つかりませんでした');
};

/**
 * すべてのデータベース操作をまとめて行う関数
 * (実質的なトランザクション処理)
 */
const performDatabaseOperations = async (
    event: H3Event,
    userId: string,
    shop: ShopInfo
): Promise<void> => {
    const supabase = await serverSupabaseServiceRole(event);

    try {
        // ステップ6: ショップデータの登録・更新
        const { data: shopData, error: shopSelectError } = await supabase
            .from('shops')
            .select('id')
            .eq('id', shop.id)
            .maybeSingle();

        if (shopSelectError) {
            console.error('Error selecting shop data:', shopSelectError);
            throw new Error('ショップデータの検索に失敗しました');
        }

        // ショップが存在しない場合は新規登録
        if (!shopData) {
            const { error: insertShopError } = await supabase
                .from('shops')
                .insert({
                    id: shop.id,
                    name: shop.name || 'Unknown Shop',
                    thumbnail: shop.thumbnail,
                    verified: false,
                });

            if (insertShopError) {
                console.error('Error inserting shop data:', insertShopError);
                throw new Error('ショップデータの登録に失敗しました');
            }
        }

        // ステップ7: ユーザーとショップの関連付け
        const { error: userShopError } = await supabase
            .from('user_shops')
            .insert({
                shop_id: shop.id,
                user_id: userId,
            });

        if (userShopError) {
            console.error('Error inserting user shop relation:', userShopError);
            throw new Error('ユーザーとショップの関連付けに失敗しました');
        }

        // 使用済み認証コードの削除
        await supabase.from('shop_verification').delete().eq('user_id', userId);

        // ステップ8: ショップオーナーバッジの付与
        const { error: badgeUpsertError } = await supabase
            .from('user_badges')
            .upsert({
                user_id: userId,
                name: 'shop_owner',
            });

        if (badgeUpsertError) {
            console.error(
                'Failed to assign shop_owner badge:',
                badgeUpsertError
            );
            // バッジ付与は重要でないため、エラーでも処理を続行
        }
    } catch (error) {
        console.error('Database operation error:', error);
        throw new Error('データベース操作中にエラーが発生しました');
    }
};
