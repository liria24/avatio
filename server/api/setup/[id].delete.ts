import database from '@@/database'
import { setups } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi(
    async (session) => {
        const { id } = await validateParams(params)

        const data = await database.query.setups.findFirst({
            where: (setups, { eq }) => eq(setups.id, id),
            columns: {
                userId: true,
            },
        })

        if (!data || data.userId !== session.user.id)
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden',
            })

        await database.delete(setups).where(eq(setups.id, Number(id)))

        return null
    },
    {
        errorMessage: 'Failed to delete setup',
        requireSession: true,
    }
)
