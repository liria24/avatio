import { bookmarks } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default authedSessionEventHandler(
    async ({ session }) => {
        const { id } = await validateParams(params)

        await db
            .delete(bookmarks)
            .where(and(eq(bookmarks.setupId, id), eq(bookmarks.userId, session.user.id)))

        return null
    },
    {
        rejectBannedUser: true,
    }
)
