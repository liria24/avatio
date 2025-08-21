import database from '@@/database'
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

        const data = await database.query.setupDrafts.findMany({
            where: (table, { and, eq, inArray }) => {
                const conditions = [eq(table.userId, session.user.id)]

                if (id) conditions.push(inArray(table.id, id))

                return and(...conditions)
            },
            columns: {
                id: true,
            },
        })

        const result = await database
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
