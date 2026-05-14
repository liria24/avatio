import { waitUntil } from '@vercel/functions'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})
const bodySchema = z.object({
    role: z
        .union([z.enum(['admin', 'user']), z.array(z.enum(['admin', 'user']))])
        .nullable()
        .optional(),
    revokeUserSessions: z.union([z.boolean(), z.stringbool()]).nullable().optional(),
    ban: z.union([z.boolean(), z.stringbool()]).nullable().optional(),
    banReason: z.string().optional(),
    banExpiresIn: z.number().optional(),
})

export default adminSessionEventHandler(async () => {
    const { id: userId } = await validateParams(params)
    const body = await validateBody(bodySchema)
    const { headers } = useEvent()

    if (body.revokeUserSessions)
        await auth.api.revokeUserSessions({
            headers,
            body: { userId },
        })

    if (body.role !== undefined && body.role !== null) {
        await auth.api.setRole({
            headers,
            body: { userId, role: body.role },
        })
        await createNotification({
            userId,
            type: 'user_role_changed',
            payload: {
                content: Array.isArray(body.role) ? body.role.join(', ') : body.role,
            },
            actionUrl: `/@${userId}`,
        })
    }

    if (body.ban !== undefined && body.ban !== null)
        if (body.ban) {
            await auth.api.banUser({
                headers,
                body: {
                    userId,
                    banReason: body.banReason,
                    banExpiresIn: body.banExpiresIn,
                },
            })
            await createNotification({
                userId,
                type: 'user_banned',
                payload: {
                    content: body.banReason || undefined,
                    banExpiresIn: body.banExpiresIn,
                },
                actionUrl: `/@${userId}`,
            })
        } else {
            await auth.api.unbanUser({
                headers,
                body: {
                    userId,
                },
            })
            await createNotification({
                userId,
                type: 'user_unbanned',
                payload: {},
                actionUrl: `/@${userId}`,
            })
        }

    waitUntil(purgeUserCache(userId))

    return
})
