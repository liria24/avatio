import { consola } from 'consola'
import type { z } from 'zod/v4'

type Body = z.infer<typeof auditLogsInsertSchema>

export default async (body: Body): Promise<{ id: number } | null> => {
    try {
        const config = useRuntimeConfig()

        const response = await $fetch('/api/admin/audit-log', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${config.adminKey}`,
            },
            body,
        })
        return response
    } catch (error) {
        consola.error('Failed to create audit log:', error)
        return null
    }
}
