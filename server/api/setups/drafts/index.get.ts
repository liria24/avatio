import database from '@@/database'
import { z } from 'zod'

const query = z.object({
    id: z
        .union([z.uuid(), z.uuid().array()])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .optional(),
    setupId: z
        .union([z.string().transform((val) => Number(val)), z.number()])
        .optional(),
})

export default defineApi<SetupDraft[]>(
    async ({ session }) => {
        const { id, setupId } = await validateQuery(query)

        const data = await database.query.setupDrafts.findMany({
            where: (table, { and, eq, inArray }) => {
                const conditions = [eq(table.userId, session!.user.id)]

                if (id) conditions.push(inArray(table.id, id))

                if (setupId) conditions.push(eq(table.setupId, setupId))

                return and(...conditions)
            },
            orderBy: (table, { desc }) => desc(table.updatedAt),
            limit: 32,
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
            content: draft.content as SetupDraftContent,
        }))
    },
    {
        errorMessage: 'Failed to get setups',
        requireSession: true,
        rejectBannedUser: true,
    }
)
