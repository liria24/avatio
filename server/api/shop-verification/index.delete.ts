import database from '@@/database'
import { userBadges, userShops } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const body = z.object({
    shopId: z.string().min(1, 'Shop ID is required'),
})

export default defineApi(
    async ({ session }) => {
        // リクエストボディの検証
        const { shopId } = await validateBody(body)

        // ショップを削除
        await database
            .delete(userShops)
            .where(
                and(
                    eq(userShops.userId, session.user.id),
                    eq(userShops.shopId, shopId)
                )
            )

        const shops = await database.query.userShops.findFirst({
            where: (userShops, { eq }) => eq(userShops.userId, session.user.id),
        })
        if (!shops)
            await database
                .delete(userBadges)
                .where(
                    and(
                        eq(userBadges.userId, session.user.id),
                        eq(userBadges.badge, 'shop_owner')
                    )
                )

        return { success: true }
    },
    {
        errorMessage: 'Failed to unverify shop.',
        requireSession: true,
    }
)
