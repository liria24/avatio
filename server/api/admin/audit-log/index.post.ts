import { auditLogs } from '@@/database/schema'

const body = auditLogsInsertSchema

export default adminSessionEventHandler<{ id: number }>(async () => {
    const { userId, action, targetType, targetId, details } = await validateBody(body)

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

    if (!data) throw createError({ status: 500, statusText: 'Failed to create audit log' })

    return data
})
