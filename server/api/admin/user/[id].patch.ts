import { auth } from '@@/better-auth'
import { z } from 'zod/v4'

const params = z.object({
    id: z.string(),
})
const bodySchema = z.object({
    role: z
        .union([z.enum(['admin', 'user']), z.array(z.enum(['admin', 'user']))])
        .nullable()
        .optional(),
    revokeUserSessions: z
        .union([z.boolean(), z.stringbool()])
        .nullable()
        .optional(),
    ban: z.union([z.boolean(), z.stringbool()]).nullable().optional(),
    banReason: z.string().optional(),
    banExpiresIn: z.number().optional(),
})

export default defineApi(
    async () => {
        const { id: userId } = await validateParams(params)
        const body = await validateBody(bodySchema)
        const { headers } = useEvent()

        if (body.revokeUserSessions)
            await auth.api.revokeUserSessions({
                headers,
                body: { userId },
            })

        if (body.role !== undefined && body.role !== null)
            await auth.api.setRole({
                headers,
                body: { userId, role: body.role },
            })

        if (body.ban !== undefined && body.ban !== null)
            if (body.ban)
                await auth.api.banUser({
                    headers,
                    body: {
                        userId,
                        banReason: body.banReason,
                        banExpiresIn: body.banExpiresIn,
                    },
                })
            else
                await auth.api.unbanUser({
                    headers,
                    body: {
                        userId,
                    },
                })

        return
    },
    {
        errorMessage: 'Failed to patch user',
        requireAdmin: true,
    }
)
