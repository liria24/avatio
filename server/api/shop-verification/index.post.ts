import { userBadges, userShops, userShopVerifications } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { joinURL } from 'ufo'
import { z } from 'zod'

const body = z.object({
    url: z.url({ error: 'URL must be in valid format' }),
})

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const { url } = await validateBody(body)

        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `shop-verification:${session.user.id}`,
        })

        const config = useRuntimeConfig(event)

        // URLからアイテムIDを抽出
        const itemId = extractItemId(url)
        if (!itemId) throw serverError.badRequest()

        // Boothからアイテム情報を取得
        const item = await $fetch<Booth>(joinURL(config.booth.proxyUrl, itemId.id))

        // ショップが既に登録されているか確認
        const existingShop = await db.query.userShops.findFirst({
            where: {
                shopId: { eq: item.shop.subdomain },
                userId: { eq: session.user.id },
            },
            columns: { id: true },
        })

        if (existingShop) return { success: true, shopId: item.shop.subdomain }

        // ユーザーの検証コードを取得
        const verificationCode = await db.query.userShopVerifications.findFirst({
            where: { userId: { eq: session.user.id } },
            columns: { code: true },
        })

        if (!verificationCode) {
            const racedShop = await db.query.userShops.findFirst({
                where: {
                    shopId: { eq: item.shop.subdomain },
                    userId: { eq: session.user.id },
                },
                columns: { id: true },
            })
            if (racedShop) return { success: true, shopId: item.shop.subdomain }
            throw serverError.internalServerError()
        }

        // 検証コードがアイテムの説明に含まれているか確認
        if (!item.description?.includes(verificationCode.code))
            throw serverError.badRequest({
                responseMessage: 'Verification code not found in item description',
            })

        // アイテムの詳細情報を取得
        const itemData = await event.$fetch<Required<Item>>(`/api/items/${itemId.id}`, {
            query: { platform: itemId.platform },
        })

        const shopId = itemData.shop!.id
        await executeD1Batch(db, [
            db
                .insert(userShops)
                .values({ userId: session.user.id, shopId })
                .onConflictDoNothing({ target: [userShops.userId, userShops.shopId] }),
            db
                .insert(userBadges)
                .values({
                    userId: session.user.id,
                    badge: 'shop_owner',
                })
                .onConflictDoNothing({ target: [userBadges.userId, userBadges.badge] }),
            db
                .delete(userShopVerifications)
                .where(eq(userShopVerifications.userId, session.user.id)),
        ])

        await purgeUserContentCache(event, db, session.user.id, 'shop verification')

        return { success: true, shopId }
    },
    {
        rejectBannedUser: true,
    },
)
