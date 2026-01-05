import { notifications } from '@@/database/schema'
import type { Notification } from '@@/shared/types/database'
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
            db.$count(
                notifications,
                and(
                    eq(notifications.userId, userId),
                    isNull(notifications.readAt)
                )
            ),
            db.query.notifications.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                where: {
                    userId: { eq: userId },
                    readAt:
                        status.includes('read') && !status.includes('unread')
                            ? { isNotNull: true }
                            : !status.includes('read') &&
                                status.includes('unread')
                              ? { isNull: true }
                              : undefined,
                    id:
                        !status.includes('read') && !status.includes('unread')
                            ? { isNull: true }
                            : undefined,
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
                ...notification,
                data: notification.data ? JSON.parse(notification.data) : null,
            })),
            unread: Number(unreadCount),
        }
    },
    {
        errorMessage: 'Failed to get notifications.',
        requireSession: true,
    }
)
