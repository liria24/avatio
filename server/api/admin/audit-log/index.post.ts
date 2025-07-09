import database from '@@/database'
import { auditLogs } from '@@/database/schema'

const body = auditLogsInsertSchema

export default defineApi<
    { id: number },
    {
        errorMessage: 'Failed to post audit log.'
        requireAdmin: true
    }
>(async () => {
    const { userId, action, targetType, targetId, details } =
        await validateBody(body)

    const data = await database
        .insert(auditLogs)
        .values({
            userId,
            action,
            targetType,
            targetId,
            details,
        })
        .returning({
            id: auditLogs.id,
        })

    return data[0]
})
