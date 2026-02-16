import {
    feedbacks,
    itemReports,
    items,
    setupReports,
    setups,
    user,
    userReports,
} from '@@/database/schema'
import { and, count, eq, exists, isNull, or, sql } from 'drizzle-orm'

export default adminSessionEventHandler(async () => {
    const [
        [usersCount],
        [setupsCount],
        [itemsCount],
        [feedbacksCount],
        [itemReportsCount],
        [setupReportsCount],
        [userReportsCount],
    ] = await Promise.all([
        db
            .select({ total: count() })
            .from(user)
            .where(or(eq(user.banned, false), isNull(user.banned))),
        db
            .select({ count: count() })
            .from(setups)
            .leftJoin(user, sql`${user.id} = ${setups.userId}`)
            .where(
                and(
                    isNull(setups.hidAt),
                    exists(
                        database
                            .select()
                            .from(user)
                            .where(
                                and(
                                    eq(user.id, setups.userId),
                                    or(eq(user.banned, false), isNull(user.banned)),
                                ),
                            ),
                    ),
                ),
            ),
        db.select({ count: count() }).from(items).where(eq(items.outdated, false)),
        db.select({ count: count() }).from(feedbacks).where(eq(feedbacks.isClosed, false)),
        db.select({ count: count() }).from(itemReports).where(eq(itemReports.isResolved, false)),
        db.select({ count: count() }).from(setupReports).where(eq(setupReports.isResolved, false)),
        db.select({ count: count() }).from(userReports).where(eq(userReports.isResolved, false)),
    ])

    return {
        users: usersCount?.total,
        setups: setupsCount?.count,
        items: itemsCount?.count,
        feedbacks: feedbacksCount?.count,
        itemReports: itemReportsCount?.count,
        setupReports: setupReportsCount?.count,
        userReports: userReportsCount?.count,
    }
})
