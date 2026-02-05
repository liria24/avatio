import { userReports } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = userReportsUpdateSchema.pick({
    isResolved: true,
})

export default adminSessionEventHandler(async () => {
    const { id } = await validateParams(params)
    const { isResolved } = await validateBody(body)

    await db
        .update(userReports)
        .set({
            isResolved,
        })
        .where(eq(userReports.id, id))

    return null
})
