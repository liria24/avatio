import {
    feedbacks,
    itemReports,
    items,
    setupReports,
    setups,
    users,
    userReports,
} from '@@/database/schema'
import { sql } from 'drizzle-orm'

export default adminSessionEventHandler(async () => {
    const result = await db.execute(sql`
        SELECT
            (SELECT COUNT(*) FROM ${users}
                WHERE ${users.banned} = false OR ${users.banned} IS NULL
            )::int AS users,
            (SELECT COUNT(*) FROM ${setups}
                WHERE ${setups.hidAt} IS NULL
                AND EXISTS (
                    SELECT 1 FROM ${users} AS u
                    WHERE u.id = ${setups.userId}
                    AND (u.banned = false OR u.banned IS NULL)
                )
            )::int AS setups,
            (SELECT COUNT(*) FROM ${items}
                WHERE ${items.outdated} = false
            )::int AS items,
            (SELECT COUNT(*) FROM ${feedbacks}
                WHERE ${feedbacks.isClosed} = false
            )::int AS feedbacks,
            (SELECT COUNT(*) FROM ${itemReports}
                WHERE ${itemReports.isResolved} = false
            )::int AS "itemReports",
            (SELECT COUNT(*) FROM ${setupReports}
                WHERE ${setupReports.isResolved} = false
            )::int AS "setupReports",
            (SELECT COUNT(*) FROM ${userReports}
                WHERE ${userReports.isResolved} = false
            )::int AS "userReports"
    `)

    const row = result.rows[0] as {
        users: number
        setups: number
        items: number
        feedbacks: number
        itemReports: number
        setupReports: number
        userReports: number
    }

    return {
        users: row?.users,
        setups: row?.setups,
        items: row?.items,
        feedbacks: row?.feedbacks,
        itemReports: row?.itemReports,
        setupReports: row?.setupReports,
        userReports: row?.userReports,
    }
})
