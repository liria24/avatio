import database from '@@/database'
import { z } from 'zod'

const query = z.object({
    setupId: z
        .union([z.string().transform((val) => Number(val)), z.number()])
        .optional(),
})

export default defineApi(
    async ({ session }) => {
        const { setupId } = await validateQuery(query)

        const data = await database.query.setupDrafts.findMany({
            where: (table, { and, eq }) => {
                const conditions = [eq(table.userId, session.user.id)]
                if (setupId) conditions.push(eq(table.setupId, setupId))

                return and(...conditions)
            },
            columns: {
                id: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                setupId: true,
                content: true,
            },
        })

        return data.map((draft) => ({
            ...draft,
            createdAt: draft.createdAt.toISOString(),
            updatedAt: draft.updatedAt.toISOString(),
            content: draft.content as SetupDraftContent,
        }))
    },
    {
        errorMessage: 'Failed to get setups',
        requireSession: true,
        rejectBannedUser: true,
    }
)
