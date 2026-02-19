import { bookmarks } from '@@/database/schema'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default authedSessionEventHandler(
    async ({ session }) => {
        const { id } = await validateParams(params)

        await db
            .insert(bookmarks)
            .values({
                setupId: id,
                userId: session.user.id,
            })
            .onConflictDoNothing()

        return null
    },
    {
        rejectBannedUser: true,
    },
)
