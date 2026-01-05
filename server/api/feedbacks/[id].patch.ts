import { feedbacks } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

const body = z
    .object({
        isClosed: z.union([z.boolean(), z.stringbool()]),
    })
    .partial()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one field must be provided',
    })

export default defineApi<Feedback>(
    async () => {
        const { id } = await validateParams(params)
        const { isClosed } = await validateBody(body)

        const data = await db
            .update(feedbacks)
            .set({
                isClosed,
            })
            .where(eq(feedbacks.id, id))
            .returning()

        return data[0]
    },
    {
        errorMessage: 'Failed to update feedbacks.',
        requireAdmin: true,
    }
)
