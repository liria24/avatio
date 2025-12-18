import { setupDrafts } from '@@/database/schema'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    id: z
        .union([z.uuid(), z.uuid().array()])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .optional(),
})

export default defineApi(
    async ({ session }) => {
        const { id } = await validateQuery(query)

        const data = await db.query.setupDrafts.findMany({
            where: {
                userId: { eq: session.user.id },
                id: id ? { in: id } : undefined,
            },
            columns: {
                id: true,
            },
        })

        const result = await db
            .delete(setupDrafts)
            .where(
                inArray(
                    setupDrafts.id,
                    data.map((draft) => draft.id)
                )
            )
            .returning()

        return {
            success: result.map((draft) => ({ id: draft.id })),
        }
    },
    {
        errorMessage: 'Failed to delete setup drafts',
        requireSession: true,
        rejectBannedUser: true,
    }
)
