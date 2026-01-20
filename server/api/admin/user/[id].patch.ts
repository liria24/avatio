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
            title: 'あなたのアカウントの権限が変更されました',
            type: 'user_role_changed',
            message: `あなたのアカウントの権限が ${Array.isArray(body.role) ? body.role.join(', ') : body.role} に変更されました`,
            actionUrl: `/@${userId}`,
            actionLabel: 'アカウントを確認する',
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
                title: 'あなたのアカウントは BAN されました',
                type: 'user_banned',
                message: body.banReason || undefined,
                data: JSON.stringify({
                    banExpiresIn: body.banExpiresIn,
                }),
                actionUrl: `/@${userId}`,
                actionLabel: 'アカウントを確認する',
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
                title: 'あなたのアカウントは BAN 解除されました',
                type: 'user_unbanned',
                actionUrl: `/@${userId}`,
                actionLabel: 'アカウントを確認する',
            })
        }

    purgeUserCache(userId)

    return
})
