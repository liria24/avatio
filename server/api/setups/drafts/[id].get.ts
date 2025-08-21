import database from '@@/database'
import { z } from 'zod'

const params = z.object({
    id: z.uuid(),
})

export default defineApi(
    async ({ session }) => {
        const { id } = await validateParams(params)

        const data = await database.query.setupDrafts.findFirst({
            where: (table, { and, eq }) =>
                and(eq(table.id, id), eq(table.userId, session.user.id)),
            columns: {
                id: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                setupId: true,
                content: true,
            },
        })

        if (!data)
            throw createError({
                statusCode: 404,
                statusMessage: 'Draft not found',
            })

        return {
            ...data,
            createdAt: data.createdAt.toISOString(),
            updatedAt: data.updatedAt.toISOString(),
            content: data.content as SetupDraftContent,
        }
    },
    {
        errorMessage: 'Failed to get setups',
        requireSession: true,
        rejectBannedUser: true,
    }
)
