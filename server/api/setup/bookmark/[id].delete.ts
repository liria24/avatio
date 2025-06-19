import database from '@@/database'
import { bookmarks } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi(
    async (session) => {
        const { id } = await validateParams(params)

        const data = await database.query.bookmarks.findFirst({
            where: (bookmarks, { eq }) => eq(bookmarks.id, id),
            columns: {
                userId: true,
            },
        })

        if (!data || data.userId !== session.user.id)
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden',
            })

        await database.delete(bookmarks).where(eq(bookmarks.id, Number(id)))

        return null
    },
    {
        errorMessage: 'Failed to delete bookmark',
        requireSession: true,
        ratelimit: true,
    }
)
