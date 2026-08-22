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

export default adminSessionEventHandler(async ({ db, event }) => {
    const { id: userId } = await validateParams(params)
    const body = await validateBody(bodySchema)
    const { headers } = event
    const currentUser = await db.query.users.findFirst({
        where: { id: { eq: userId } },
        columns: { role: true, banned: true },
    })
    if (!currentUser) throw serverError.notFound()
    const getRevision = async () =>
        (
            await db.query.users.findFirst({
                where: { id: { eq: userId } },
                columns: { updatedAt: true },
            })
        )?.updatedAt.getTime() ?? 0

    if (body.revokeUserSessions)
        await getAuth(event).api.revokeUserSessions({
            headers,
            body: { userId },
        })

    if (body.role !== undefined && body.role !== null) {
        const role = Array.isArray(body.role) ? body.role.join(',') : body.role
        if (currentUser.role !== role) {
            await getAuth(event).api.setRole({
                headers,
                body: { userId, role: body.role },
            })
            await createNotification(db, {
                userId,
                type: 'user_role_changed',
                dedupeKey: `admin:${userId}:role:${role}:${await getRevision()}`,
                payload: { content: role },
                actionUrl: `/@${userId}`,
            })
        }
    }

    if (body.ban !== undefined && body.ban !== null)
        if (body.ban && !currentUser.banned) {
            await getAuth(event).api.banUser({
                headers,
                body: {
                    userId,
                    banReason: body.banReason,
                    banExpiresIn: body.banExpiresIn,
                },
            })
            await createNotification(db, {
                userId,
                type: 'user_banned',
                dedupeKey: `admin:${userId}:banned:${await getRevision()}`,
                payload: {
                    content: body.banReason || undefined,
                    banExpiresIn: body.banExpiresIn,
                },
                actionUrl: `/@${userId}`,
            })
        } else if (!body.ban && currentUser.banned) {
            await getAuth(event).api.unbanUser({
                headers,
                body: {
                    userId,
                },
            })
            await createNotification(db, {
                userId,
                type: 'user_unbanned',
                dedupeKey: `admin:${userId}:unbanned:${await getRevision()}`,
                payload: {},
                actionUrl: `/@${userId}`,
            })
        }

    return
})
