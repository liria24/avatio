import type { z } from 'zod'

type Body = z.infer<typeof notificationsInsertSchema>

export default async (body: Body): Promise<{ id: string } | null> => {
    const log = logger('createNotification')

    try {
        const config = useRuntimeConfig()

        const response = await $fetch('/api/notifications', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${config.adminKey}`,
            },
            body,
        })
        return response || null
    } catch (error) {
        log.error('Failed to create notification:', error)
        return null
    }
}
