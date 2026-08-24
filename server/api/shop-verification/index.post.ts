import {
    publisherVerificationChallenges,
    userBadges,
    userPublishers,
    userShops,
    userShopVerifications,
} from '@@/database/schema'
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

        // URLからアイテムIDを抽出
        const itemId = extractItemId(url)
        if (!itemId) throw serverError.badRequest()

        // Boothからアイテム情報を取得
        const proxyUrl = getRuntimeEnvString('BOOTH_PROXY_URL', event)
        if (!proxyUrl) throw serverError.internalServerError()
        const item = await $fetch<Booth>(joinURL(proxyUrl, itemId.id))

        // ショップが既に登録されているか確認
        const existingShop = await db.query.userShops.findFirst({
            where: {
                shopId: { eq: item.shop.subdomain },
                userId: { eq: session.user.id },
            },
            columns: { id: true },
        })

        if (existingShop) {
            const existingPublisherSource = await db.query.publisherSources.findFirst({
                where: {
                    providerKey: { eq: itemId.platform },
                    externalId: { eq: item.shop.subdomain },
                },
                columns: { publisherId: true },
            })
            if (existingPublisherSource)
                await db
                    .insert(userPublishers)
                    .values({
                        userId: session.user.id,
                        publisherId: existingPublisherSource.publisherId,
                    })
                    .onConflictDoNothing({
                        target: [userPublishers.userId, userPublishers.publisherId],
                    })
            return { success: true, shopId: item.shop.subdomain }
        }

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
        const publisherSource = await db.query.publisherSources.findFirst({
            where: {
                providerKey: { eq: itemId.platform },
                externalId: { eq: shopId },
            },
            columns: { publisherId: true },
        })
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
            db
                .delete(publisherVerificationChallenges)
                .where(eq(publisherVerificationChallenges.userId, session.user.id)),
            ...(publisherSource
                ? [
                      db
                          .insert(userPublishers)
                          .values({
                              userId: session.user.id,
                              publisherId: publisherSource.publisherId,
                          })
                          .onConflictDoNothing({
                              target: [userPublishers.userId, userPublishers.publisherId],
                          }),
                  ]
                : []),
        ])

        await invalidateUserContentCache(event, db, session.user.id, 'shop verification')

        return { success: true, shopId }
    },
    {
        rejectBannedUser: true,
    },
)
