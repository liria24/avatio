import { feedbacks, itemReports, items, setupReports, userReports } from '@@/database/schema'
import { count, eq } from 'drizzle-orm'

export default adminSessionEventHandler(async () => {
    const [
        feedbackCountResult,
        itemCountResult,
        itemReportCountResult,
        setupReportCountResult,
        userReportCountResult,
    ] = await Promise.all([
        db.select({ count: count() }).from(feedbacks).where(eq(feedbacks.isClosed, false)),
        db.select({ count: count() }).from(items),
        db.select({ count: count() }).from(itemReports).where(eq(itemReports.isResolved, false)),
        db.select({ count: count() }).from(setupReports).where(eq(setupReports.isResolved, false)),
        db.select({ count: count() }).from(userReports).where(eq(userReports.isResolved, false)),
    ])

    return {
        feedbackOpenCount: feedbackCountResult[0]?.count ?? 0,
        itemCount: itemCountResult[0]?.count ?? 0,
        reportOpenCount:
            (itemReportCountResult[0]?.count ?? 0) +
            (setupReportCountResult[0]?.count ?? 0) +
            (userReportCountResult[0]?.count ?? 0),
    }
})
