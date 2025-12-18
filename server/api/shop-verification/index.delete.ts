import { userBadges, userShops } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const body = z.object({
    shopId: z.string().min(1, 'Shop ID is required'),
})

export default defineApi(
    async ({ session }) => {
        // リクエストボディの検証
        const { shopId } = await validateBody(body)

        // ショップを削除
        await db
            .delete(userShops)
            .where(
                and(
                    eq(userShops.userId, session.user.id),
                    eq(userShops.shopId, shopId)
                )
            )

        const shops = await db.query.userShops.findFirst({
            where: {
                userId: { eq: session.user.id },
            },
            columns: {
                id: true,
            },
        })
        if (!shops)
            await db
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
