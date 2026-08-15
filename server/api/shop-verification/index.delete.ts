import { userBadges, userShops } from '@@/database/schema'
import { and, eq, notExists } from 'drizzle-orm'
import { z } from 'zod'

const body = z.object({
    shopId: z.string().min(1, 'Shop ID is required'),
})

export default authedSessionEventHandler(async ({ event, session, db }) => {
    // リクエストボディの検証
    const { shopId } = await validateBody(body)

    await executeD1Batch(db, [
        db
            .delete(userShops)
            .where(and(eq(userShops.userId, session.user.id), eq(userShops.shopId, shopId))),
        db
            .delete(userBadges)
            .where(
                and(
                    eq(userBadges.userId, session.user.id),
                    eq(userBadges.badge, 'shop_owner'),
                    notExists(
                        db
                            .select({ id: userShops.id })
                            .from(userShops)
                            .where(eq(userShops.userId, session.user.id)),
                    ),
                ),
            ),
    ])

    await purgeUserContentCache(event, db, session.user.id, 'shop verification removal')

    return { success: true }
})
