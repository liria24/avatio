import database from '@@/database'
import { notifications } from '@@/database/schema'
import type { Notification } from '@@/shared/types'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    status: z
        .union([
            z.enum(['read', 'unread']),
            z.array(z.enum(['read', 'unread'])),
        ])
        .transform((value) => (Array.isArray(value) ? value : [value]))
        .optional()
        .default(['unread', 'read']),
})

export default defineApi<{
    data: Notification[]
    unread: number
}>(
    async ({ session }) => {
        const { status } = await validateQuery(query)
        const userId = session!.user.id

        const [unreadCount, data] = await Promise.all([
            database.$count(
                notifications,
                and(
                    eq(notifications.userId, userId),
                    isNull(notifications.readAt)
                )
            ),
            database.query.notifications.findMany({
                orderBy: (notifications, { desc }) =>
                    desc(notifications.createdAt),
                where: (table, { eq, and, isNotNull, isNull }) => {
                    const conditions = [eq(table.userId, userId)]

                    const hasRead = status.includes('read')
                    const hasUnread = status.includes('unread')

                    if (hasRead && !hasUnread)
                        conditions.push(isNotNull(table.readAt))
                    else if (!hasRead && hasUnread)
                        conditions.push(isNull(table.readAt))
                    else if (!hasRead && !hasUnread)
                        conditions.push(isNull(table.id))

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
                    banner: true,
                },
            }),
        ])

        return {
            data: data.map((notification) => ({
                id: notification.id,
                createdAt: notification.createdAt.toISOString(),
                type: notification.type,
                readAt: notification.readAt?.toISOString() || null,
                title: notification.title,
                message: notification.message,
                data: notification.data ? JSON.parse(notification.data) : null,
                actionUrl: notification.actionUrl,
                actionLabel: notification.actionLabel,
                banner: notification.banner,
            })),
            unread: Number(unreadCount),
        }
    },
    {
        errorMessage: 'Failed to get notifications.',
        requireSession: true,
    }
)
