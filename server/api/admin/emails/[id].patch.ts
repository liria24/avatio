import { emails } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = z
    .object({
        isRead: z.boolean(),
        isArchived: z.boolean(),
    })
    .partial()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one field must be provided',
    })

export default adminSessionEventHandler(async () => {
    const { id } = await validateParams(params)
    const { isRead, isArchived } = await validateBody(body)

    const [data] = await db
        .update(emails)
        .set({ isRead, isArchived })
        .where(eq(emails.id, id))
        .returning()

    if (!data) throw serverError.notFound()

    return data
})
