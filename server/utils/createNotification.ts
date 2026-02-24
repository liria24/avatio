import { destr } from 'destr'
import type { z } from 'zod'
import type { NotificationPayload } from '~~/database/schema'
import { notifications } from '~~/database/schema'

type Body = Omit<z.infer<typeof notificationsInsertSchema>, 'payload'> & {
    payload: NotificationPayload
}

export default async (body: Body): Promise<{ id: string } | null> => {
    const log = logger('createNotification')

    try {
        const { userId, type, payload, actionUrl, banner } = body

        const [result] = await db
            .insert(notifications)
            .values({
                userId,
                type,
                payload: destr(payload),
                actionUrl,
                banner,
            })
            .returning({ id: notifications.id })

        return result || null
    } catch (error) {
        log.error('Failed to create notification:', error)
        return null
    }
}
