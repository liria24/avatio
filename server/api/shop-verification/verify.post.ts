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
            required_error: 'URL is required',
            invalid_type_error: 'URL must be a string',
        })
        .min(1, 'URL is required')
        .url('URL must be in valid format')
        .refine(
            (url) => {
                try {
                    const parsedUrl = new URL(url);
                    return parsedUrl.hostname.endsWith('.booth.pm');
                } catch {
                    return false;
                }
            },
            { message: 'Only BOOTH URLs can be verified' }
        ),
});

export type RequestBody = z.infer<typeof requestBodySchema>;

/**
 * エラーを作成する共通関数
 */
const createCustomError = (statusCode: number, message: string) => {
    console.error(`Error: ${message}`);
    return createError({
        statusCode,
        message,
    });
};

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
            throw createCustomError(
                400,
                `Invalid request: ${result.error.issues.map((i) => i.message).join(', ')}`
            );
        }

        const { url } = result.data;

        // ステップ1: ユーザーログインの確認
        const user = await serverSupabaseUser(event);
        if (!user) {
            console.error('User not logged in');
            throw createCustomError(403, 'Login required');
        }

        const supabase = await serverSupabaseServiceRole<Database>(event);

        try {
            // ステップ2: URLの解析
            const destinationUrl = new URL(url);
            const baseUrl = `${destinationUrl.origin}${destinationUrl.pathname}`;
            const subDomain = boothSubDomain(url);

            if (!subDomain || subDomain.length < 2) {
                throw createCustomError(400, 'Not a valid BOOTH shop URL');
            }

            // ステップ3: 既存の認証チェック
            const { data: existingUserShop, error: selectError } =
                await supabase
                    .from('user_shops')
                    .select('user_id, shop_id')
                    .eq('user_id', user.id)
                    .eq('shop_id', subDomain);

            if (selectError) {
                console.error(
                    'Error checking existing user shop:',
                    selectError
                );
                throw createCustomError(
                    500,
                    'Failed to retrieve user shop information'
                );
            }

            if (existingUserShop?.length) {
                console.log('Already verified', subDomain, user.id);
                return {
                    url,
                    verified: true,
                    message: 'Already verified',
                };
            }

            // ステップ4: ショップページの取得と解析
            const shop = await fetchAndParseShopInfo(event, baseUrl, subDomain);

            // ステップ5: 認証コードの検証
            await verifyAuthenticationCode(event, user.id, shop);

            // ステップ6-8: トランザクション的に処理
            await performDatabaseOperations(event, user.id, shop);

            // 認証成功
            setResponseStatus(event, 201);
            return {
                url,
                verified: true,
                message: 'Shop verification successful',
            };
        } catch (error) {
            console.error('Error on verification:', error);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (error && (error as any).statusCode) throw error;

            throw createCustomError(
                500,
                error instanceof Error
                    ? error.message
                    : 'An error occurred during verification'
            );
        }
    }
);

/**
 * ショップ情報を取得して解析する関数
 */
const fetchAndParseShopInfo = async (
    event: H3Event,
    baseUrl: string,
    subDomain: string
): Promise<ShopInfo> => {
    try {
        const html = await event.$fetch<string>(baseUrl, {
            responseType: 'text',
            timeout: 30000,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            },
        });

        const $ = load(html);

        return {
            id: subDomain,
            name: extractShopName($),
            thumbnail: extractShopThumbnail($),
            description: extractShopDescription($),
        };
    } catch (error) {
        console.error('Error fetching shop page:', error);
        throw createCustomError(503, 'Failed to access shop URL');
    }
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
    const description =
        $('div.description').text().trim() ||
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '';

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
        console.error('Error retrieving verification code:', codeError);
        throw createCustomError(500, 'Failed to retrieve verification code');
    }

    if (!codeData?.code) {
        console.error('Verification code not found for user:', userId);
        throw createCustomError(
            400,
            'Verification code not found for logged-in user'
        );
    }

    // 5.2: 認証コードの有効期限チェック (10分以内)
    const TEN_MINUTES_MS = 1000 * 60 * 10;
    const codeCreatedAt = new Date(codeData.created_at);
    const codeExpiresAt = new Date(codeCreatedAt.getTime() + TEN_MINUTES_MS);

    if (new Date() > codeExpiresAt) {
        await supabase.from('shop_verification').delete().eq('user_id', userId);
        throw createCustomError(
            400,
            'Verification code expired. Please generate a new code'
        );
    }

    // 5.3: ショップ説明文に認証コードが含まれているか確認
    if (!shop.description) {
        throw createCustomError(400, 'Failed to retrieve shop description');
    }

    if (!shop.description.includes(codeData.code)) {
        throw createCustomError(
            400,
            'Verification code not found in shop description'
        );
    }
};

/**
 * すべてのデータベース操作をまとめて行う関数
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
            console.error('Error retrieving shop data:', shopSelectError);
            throw createCustomError(500, 'Failed to search shop data');
        }

        // ショップデータの登録または更新
        const shopOperation = shopData
            ? supabase
                  .from('shops')
                  .update({
                      name: shop.name,
                      thumbnail: shop.thumbnail,
                      updated_at: new Date().toISOString(),
                  })
                  .eq('id', shop.id)
            : supabase.from('shops').insert({
                  id: shop.id,
                  name: shop.name,
                  thumbnail: shop.thumbnail,
                  verified: false,
              });

        const { error: shopError } = await shopOperation;
        if (shopError) {
            throw createCustomError(500, 'Failed to save shop data');
        }

        // ステップ7: ユーザーとショップの関連付け
        const { error: userShopError } = await supabase
            .from('user_shops')
            .insert({
                shop_id: shop.id,
                user_id: userId,
            });

        if (userShopError) {
            console.error('Failed to link user with shop:', userShopError);
            throw createCustomError(500, 'Failed to link user with shop');
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
        }
    } catch (error) {
        console.error('Database operation error:', error);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (error && (error as any).statusCode) throw error;

        throw createError({
            statusCode: 500,
            message: 'Error during database operations',
        });
    }
};
