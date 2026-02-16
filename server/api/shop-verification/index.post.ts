import { userBadges, userShops, userShopVerification } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const body = z.object({
    url: z.url({ error: 'URL must be in valid format' }),
})

export default authedSessionEventHandler(
    async ({ session }) => {
        const { url } = await validateBody(body)

        // URLからアイテムIDを抽出
        const itemId = extractItemId(url)
        if (!itemId)
            throw createError({
                status: 400,
                statusText: 'Invalid URL or item ID not found',
            })

        // Boothからアイテム情報を取得
        const item = await $fetch<Booth>(`https://booth.pm/ja/items/${itemId.id}.json`, {
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
        })

        // ショップが既に登録されているか確認
        const existingShop = await db.query.userShops.findFirst({
            where: {
                shopId: { eq: item.shop.subdomain },
                userId: { eq: session.user.id },
            },
            columns: {
                id: true,
            },
        })

        if (existingShop)
            throw createError({
                status: 400,
                statusText: 'This shop is already registered',
            })

        // ユーザーの検証コードを取得
        const verificationCode = await db.query.userShopVerification.findFirst({
            where: {
                userId: { eq: session.user.id },
            },
            columns: {
                code: true,
            },
        })

        if (!verificationCode)
            throw createError({
                status: 400,
                statusText: 'Verification code not found',
            })

        // 検証コードがアイテムの説明に含まれているか確認
        if (!item.description?.includes(verificationCode.code))
            throw createError({
                status: 400,
                statusText: 'Verification code not found in item description',
            })

        // アイテムの詳細情報を取得
        const itemData = await $fetch<Required<Item>>(`/api/items/${itemId.id}`, {
            query: { platform: itemId.platform },
        })

        // ユーザーショップの登録
        await db.insert(userShops).values({
            userId: session.user.id,
            shopId: itemData.shop!.id,
        })

        // ショップオーナーバッジの付与
        await db
            .insert(userBadges)
            .values({
                userId: session.user.id,
                badge: 'shop_owner',
            })
            .onConflictDoNothing()

        // 検証コードの削除
        await db
            .delete(userShopVerification)
            .where(eq(userShopVerification.userId, session.user.id))

        return { success: true, shopId: itemData.shop?.id }
    },
    {
        rejectBannedUser: true,
    },
)
