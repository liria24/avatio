import database from '@@/database'
import { setupReports } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = setupReportsUpdateSchema.pick({
    isResolved: true,
})

export default defineApi(
    async () => {
        const { id } = await validateParams(params)
        const { isResolved } = await validateBody(body)

        await database
            .update(setupReports)
            .set({
                isResolved,
            })
            .where(eq(setupReports.id, id))

        return null
    },
    {
        errorMessage: 'Failed to update setup report.',
        requireAdmin: true,
    }
)
