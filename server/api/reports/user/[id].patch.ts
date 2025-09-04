import database from '@@/database'
import { userReports } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = userReportsUpdateSchema.pick({
    isResolved: true,
})

export default defineApi(
    async () => {
        const { id } = await validateParams(params)
        const { isResolved } = await validateBody(body)

        await database
            .update(userReports)
            .set({
                isResolved,
            })
            .where(eq(userReports.id, id))

        return null
    },
    {
        errorMessage: 'Failed to update user report.',
        requireAdmin: true,
    }
)
