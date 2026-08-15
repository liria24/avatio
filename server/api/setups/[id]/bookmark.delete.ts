import { bookmarks } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const { id } = await validateParams(params)
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `relations:${session.user.id}`,
        })

        await db
            .delete(bookmarks)
            .where(and(eq(bookmarks.setupId, id), eq(bookmarks.userId, session.user.id)))

        return null
    },
    {
        rejectBannedUser: true,
    },
)
