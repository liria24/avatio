import database from '@@/database'
import { bookmarks } from '@@/database/schema'
import { z } from 'zod/v4'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi(
    async (session) => {
        const { id } = await validateParams(params)

        await database
            .insert(bookmarks)
            .values({
                setupId: id,
                userId: session.user.id,
            })
            .onConflictDoNothing()

        return null
    },
    {
        errorMessage: 'Failed to post bookmark.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
