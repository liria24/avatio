import database from '@@/database'
import { bookmarks } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi(
    async ({ session }) => {
        const { id } = await validateParams(params)

        await database
            .delete(bookmarks)
            .where(
                and(
                    eq(bookmarks.setupId, id),
                    eq(bookmarks.userId, session.user.id)
                )
            )

        return null
    },
    {
        errorMessage: 'Failed to delete bookmark',
        requireSession: true,
        rejectBannedUser: true,
    }
)
