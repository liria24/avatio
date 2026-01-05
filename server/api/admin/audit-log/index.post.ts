import { auditLogs } from '@@/database/schema'

const body = auditLogsInsertSchema

export default defineApi<{ id: number }>(
    async () => {
        const { userId, action, targetType, targetId, details } = await validateBody(body)

        const data = await db
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
    },
    {
        errorMessage: 'Failed to post audit log.',
        requireAdmin: true,
    }
)
