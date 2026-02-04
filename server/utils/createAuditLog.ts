import type { z } from 'zod'

type Body = z.infer<typeof auditLogsInsertSchema>

export default async (body: Body): Promise<{ id: number } | null> => {
    const log = logger('createAuditLog')

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
        log.error('Failed to create audit log:', error)
        return null
    }
}
