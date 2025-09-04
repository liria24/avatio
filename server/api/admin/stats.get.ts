import database from '@@/database'
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

const getStats = defineCachedFunction(
    async () => {
        const [
            usersCount,
            setupsCount,
            itemsCount,
            feedbacksCount,
            itemReportsCount,
            setupReportsCount,
            userReportsCount,
        ] = await Promise.all([
            database
                .select({ total: count() })
                .from(user)
                .where(or(eq(user.banned, false), isNull(user.banned))),
            database
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
                                        or(
                                            eq(user.banned, false),
                                            isNull(user.banned)
                                        )
                                    )
                                )
                        )
                    )
                ),
            database
                .select({ count: count() })
                .from(items)
                .where(eq(items.outdated, false)),
            database
                .select({ count: count() })
                .from(feedbacks)
                .where(eq(feedbacks.isClosed, false)),
            database
                .select({ count: count() })
                .from(itemReports)
                .where(eq(feedbacks.isClosed, false)),
            database
                .select({ count: count() })
                .from(setupReports)
                .where(eq(feedbacks.isClosed, false)),
            database
                .select({ count: count() })
                .from(userReports)
                .where(eq(feedbacks.isClosed, false)),
        ])

        return {
            users: usersCount[0].total,
            setups: setupsCount[0].count,
            items: itemsCount[0].count,
            feedbacks: feedbacksCount[0].count,
            itemReports: itemReportsCount[0].count,
            setupReports: setupReportsCount[0].count,
            userReports: userReportsCount[0].count,
        }
    },
    {
        name: 'admin-stats',
        maxAge: 60,
        swr: true,
    }
)

export default defineApi(
    async () => {
        return await getStats()
    },
    {
        errorMessage: 'Failed to retrieve statistics',
        requireAdmin: true,
    }
)
