import { load, type CheerioAPI } from 'cheerio';
import {
    serverSupabaseServiceRole,
    serverSupabaseUser,
} from '#supabase/server';
import type { H3Event } from 'h3';
import { z } from 'zod';

// 成功時のレスポンス型定義
interface VerificationResult {
    url: string;
    verified: boolean;
    message?: string;
}

// ショップ情報の型定義
interface ShopInfo {
    id: string;
    name: string;
    thumbnail: string | null;
    description: string;
}

const requestBodySchema = z.object({
    url: z
        .string({
            required_error: 'URLが必要です',
            invalid_type_error: 'URLは文字列である必要があります',
        })
        .min(1, 'URLが必要です')
        .url('有効なURL形式である必要があります')
        .refine(
            (url) => {
                try {
                    const parsedUrl = new URL(url);
                    return parsedUrl.hostname.endsWith('.booth.pm');
                } catch {
                    return false;
                }
            },
            { message: 'BOOTHのURLのみ認証できます' }
        ),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

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
    async (event): Promise<VerificationResult> => {
        const rawBody = await readBody(event);
        const result = requestBodySchema.safeParse(rawBody);

        if (!result.success) {
            throw createError({
                statusCode: 400,
                message: `不正なリクエスト: ${result.error.issues.map((i) => i.message).join(', ')}`,
            });
        }

        const { url } = result.data;

        // ステップ1: ユーザーログインの確認
        const user = await serverSupabaseUser(event);
        if (!user) {
            console.error('Error: Needs login');
            throw createError({
                statusCode: 403,
                message: 'ログインが必要です',
            });
        }

        const supabase = await serverSupabaseServiceRole<Database>(event);

        try {
            // ステップ2: URLの解析
            const destinationUrl = new URL(url);
            const baseUrl = `${destinationUrl.origin}${destinationUrl.pathname}`;
            const subDomain = boothSubDomain(url.toString());

            if (!subDomain || subDomain.length < 2)
                throw createError({
                    statusCode: 400,
                    message: '有効なBOOTHショップURLではありません',
                });

            // ステップ3: 既存の認証チェック
            const { data: existingUserShop, error: selectError } =
                await supabase
                    .from('user_shops')
                    .select('user_id, shop_id')
                    .eq('user_id', user.id)
                    .eq('shop_id', subDomain);

            if (selectError) {
                console.error('Error selecting user shop:', selectError);
                throw createError({
                    statusCode: 500,
                    message: 'ユーザーショップ情報の取得に失敗しました',
                });
            }

            if (existingUserShop?.length) {
                console.log('Already verified', subDomain, user.id);
                // 既に認証済みの場合は成功として200を返す
                return {
                    url,
                    verified: true,
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
            setResponseStatus(event, 201); // 新しいリソース作成のため201
            return {
                url,
                verified: true,
                message: 'ショップの認証に成功しました',
            };
        } catch (error) {
            console.error('Error on verification:', error);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (error && (error as any).statusCode) throw error;

            // その他のエラーは500としてスロー
            throw createError({
                statusCode: 500,
                message:
                    error instanceof Error
                        ? error.message
                        : '認証処理中にエラーが発生しました',
            });
        }
    }
);

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
        throw createError({
            statusCode: 503,
            message: 'ショップURLへのアクセスに失敗しました',
        });
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
    const supabase = await serverSupabaseServiceRole<Database>(event);

    // 5.1: データベースから認証コードを取得
    const { data: codeData, error: codeError } = await supabase
        .from('shop_verification')
        .select('code, user_id, created_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (codeError) {
        console.error('Error fetching verification code:', codeError);
        throw createError({
            statusCode: 500,
            message: '認証コードの取得に失敗しました',
        });
    }

    if (!codeData?.code)
        throw createError({
            statusCode: 400,
            message: 'ログインユーザーの認証コードが見つかりません',
        });

    // 5.2: 認証コードの有効期限チェック (10分以内)
    const TEN_MINUTES_MS = 1000 * 60 * 10;
    const codeCreatedAt = new Date(codeData.created_at);
    const codeExpiresAt = new Date(codeCreatedAt.getTime() + TEN_MINUTES_MS);

    if (new Date() > codeExpiresAt) {
        await supabase.from('shop_verification').delete().eq('user_id', userId);

        throw createError({
            statusCode: 400,
            message:
                '認証コードの有効期限が切れました。新しいコードを生成してください',
        });
    }

    // 5.3: ショップ説明文に認証コードが含まれているか確認
    if (!shop.description)
        throw createError({
            statusCode: 400,
            message: 'ショップの説明文を取得できませんでした',
        });

    if (!shop.description.includes(codeData.code))
        throw createError({
            statusCode: 400,
            message: 'ショップの説明文に認証コードが見つかりませんでした',
        });
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
    const supabase = await serverSupabaseServiceRole<Database>(event);

    try {
        // ステップ6: ショップデータの登録・更新
        const { data: shopData, error: shopSelectError } = await supabase
            .from('shops')
            .select('id')
            .eq('id', shop.id)
            .maybeSingle();

        if (shopSelectError) {
            console.error('Error selecting shop data:', shopSelectError);
            throw createError({
                statusCode: 500,
                message: 'ショップデータの検索に失敗しました',
            });
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
                throw createError({
                    statusCode: 500,
                    message: 'ショップデータの登録に失敗しました',
                });
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
            throw createError({
                statusCode: 500,
                message: 'ユーザーとショップの関連付けに失敗しました',
            });
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

        if (badgeUpsertError)
            // バッジ付与は重要でないため、エラーでも処理を続行
            console.error(
                'Failed to assign shop_owner badge:',
                badgeUpsertError
            );
    } catch (error) {
        console.error('Database operation error:', error);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (error && (error as any).statusCode) throw error;

        throw createError({
            statusCode: 500,
            message: 'データベース操作中にエラーが発生しました',
        });
    }
};
