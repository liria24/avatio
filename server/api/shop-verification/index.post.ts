import database from '@@/database'
import { userBadges, userShops, userShopVerification } from '@@/database/schema'
import extractItemId from '@@/shared/utils/extractItemId'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const body = z.object({
    url: z.url({ error: 'URL must be in valid format' }),
})

export default defineApi(
    async ({ session }) => {
        // Rate limiting: Check if user has made a verification request recently
        const recentVerification = await database.query.userShopVerification.findFirst({
            where: (verification, { eq, and, gt }) =>
                and(
                    eq(verification.userId, session.user.id),
                    gt(verification.createdAt, new Date(Date.now() - 5 * 60 * 1000)) // 5 minutes cooldown
                ),
        })

        if (recentVerification)
            throw createError({
                statusCode: 429,
                message: 'Please wait 5 minutes before trying again',
            })

        // リクエストボディの検証
        const { url } = await validateBody(body)

        // URLからアイテムIDを抽出
        const itemId = extractItemId(url)
        if (!itemId)
            throw createError({
                statusCode: 400,
                message: 'Invalid URL or item ID not found',
            })

        // Boothからアイテム情報を取得
        const item = await $fetch<Booth>(
            `https://booth.pm/ja/items/${itemId.id}.json`,
            {
                headers: {
                    Accept: 'application/json',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                },
            }
        )

        // ショップが既に登録されているか確認
        const existingShop = await database.query.userShops.findFirst({
            where: (userShops, { eq, and }) =>
                and(
                    eq(userShops.shopId, item.shop.subdomain),
                    eq(userShops.userId, session.user.id)
                ),
        })

        if (existingShop)
            throw createError({
                statusCode: 400,
                message: 'This shop is already registered',
            })

        // ユーザーの検証コードを取得
        const verificationCode =
            await database.query.userShopVerification.findFirst({
                where: (shopVerification, { eq }) =>
                    eq(shopVerification.userId, session.user.id),
            })

        if (!verificationCode)
            throw createError({
                statusCode: 400,
                message: 'Verification code not found',
            })

        // 検証コードがアイテムの説明に含まれているか確認
        if (!item.description?.includes(verificationCode.code))
            throw createError({
                statusCode: 400,
                message: 'Verification code not found in item description',
            })

        // アイテムの詳細情報を取得
        const itemData = await $fetch<Required<Item>>(
            `/api/items/${itemId.id}`,
            {
                query: { platform: itemId.platform },
            }
        )

        // ユーザーショップの登録
        await database.insert(userShops).values({
            userId: session.user.id,
            shopId: itemData.shop.id,
        })

        // ショップオーナーバッジの付与
        await database
            .insert(userBadges)
            .values({
                userId: session.user.id,
                badge: 'shop_owner',
            })
            .onConflictDoNothing()

        // 検証コードの削除
        await database
            .delete(userShopVerification)
            .where(eq(userShopVerification.userId, session.user.id))

        return { success: true, shopId: itemData.shop.id }
    },
    {
        errorMessage: 'Failed to verify shop.',
        requireSession: true,
    }
)
