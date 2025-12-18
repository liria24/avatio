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

        const data = await db.query.setupDrafts.findMany({
            where: {
                userId: { eq: session!.user.id },
                id: id ? { in: id } : undefined,
                setupId: setupId ? { eq: setupId } : undefined,
            },
            orderBy: {
                updatedAt: 'desc',
            },
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
