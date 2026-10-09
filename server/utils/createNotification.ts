import type { z } from 'zod'
import { notifications } from '~~/database/schema'

type Body = Omit<z.input<typeof notificationsInsertSchema>, 'payload'> & {
    payload: NotificationPayload
}

export default async (db: ReturnType<typeof useDB>, body: Body): Promise<{ id: string } | null> => {
    const log = logger('createNotification')

    try {
        const { userId, type, payload, actionUrl, banner, dedupeKey } = body
        const [result] = await db
            .insert(notifications)
            .values({
                userId,
                type,
                payload,
                actionUrl,
                banner,
                dedupeKey,
            })
            .onConflictDoNothing()
            .returning({ id: notifications.id })

        return result || null
    } catch (error) {
        log.error('Failed to create notification:', error)
        return null
    }
}
