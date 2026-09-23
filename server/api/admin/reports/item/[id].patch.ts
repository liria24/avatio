import { itemReports } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = itemReportsUpdateSchema.pick({
    isResolved: true,
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { id } = await validateParams(params)
    const { isResolved } = await validateBody(body)

    await db
        .update(itemReports)
        .set({
            isResolved,
        })
        .where(eq(itemReports.id, id))

    return null
})
