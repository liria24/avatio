import { consola } from 'consola'
import type { z } from 'zod'

type Body = z.infer<typeof notificationsInsertSchema>

export default async (body: Body): Promise<{ id: string } | null> => {
    try {
        const config = useRuntimeConfig()

        const response = await $fetch('/api/notifications', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${config.adminKey}`,
            },
            body,
        })
        return response
    } catch (error) {
        consola.error('Failed to create notification:', error)
        return null
    }
}
