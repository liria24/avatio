import database from '@@/database'
import { notifications } from '@@/database/schema'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    read: z.union([z.boolean(), z.stringbool()]).optional().default(true),
    unread: z.union([z.boolean(), z.stringbool()]).optional().default(true),
})

export default defineApi(
    async (session) => {
        const { read, unread } = await validateQuery(query)

        const data = await database.query.notifications.findMany({
            extras: () => {
                const conditions = [eq(notifications.userId, session.user.id)]

                if (read && !unread)
                    conditions.push(isNotNull(notifications.readAt))
                else if (!read && unread)
                    conditions.push(isNull(notifications.readAt))
                else if (!read && !unread)
                    conditions.push(isNull(notifications.id))

                return {
                    count: database
                        .$count(notifications, and(...conditions))
                        .as('count'),
                }
            },
            orderBy: (notifications, { desc }) => desc(notifications.createdAt),
            where: (table, { eq, and, isNotNull, isNull }) => {
                const conditions = [eq(table.userId, session.user.id)]

                if (read && !unread) conditions.push(isNotNull(table.readAt))
                else if (!read && unread) conditions.push(isNull(table.readAt))
                else if (!read && !unread) conditions.push(isNull(table.id))

                return and(...conditions)
            },
            columns: {
                id: true,
                createdAt: true,
                type: true,
                readAt: true,
                title: true,
                message: true,
                data: true,
                actionUrl: true,
                actionLabel: true,
            },
        })

        return {
            data: data.map((notification) => ({
                ...notification,
                createdAt: notification.createdAt.toISOString(),
                readAt: notification.readAt?.toISOString() || null,
                data: notification.data ? JSON.parse(notification.data) : null,
            })),
            total: data[0]?.count || 0,
        }
    },
    {
        errorMessage: 'Failed to get notifications.',
        requireSession: true,
    }
)
