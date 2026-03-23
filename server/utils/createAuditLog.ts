import { auditLogs } from '@@/database/schema'
import type { z } from 'zod'

type Body = z.infer<typeof auditLogsInsertSchema>

export default async (body: Body): Promise<{ id: number } | null> => {
    const log = logger('createAuditLog')

    try {
        const { userId, action, targetType, targetId, details } = body

        const [data] = await db
            .insert(auditLogs)
            .values({
                userId,
                action,
                targetType,
                targetId,
                details,
            })
            .returning({ id: auditLogs.id })

        if (!data) throw new Error('Failed to create audit log')

        return data
    } catch (error) {
        log.error('Failed to create audit log:', error)
        return null
    }
}
