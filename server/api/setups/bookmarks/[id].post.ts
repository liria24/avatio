import { bookmarks } from '@@/database/schema'
import { z } from 'zod'

const params = z.object({
    id: z.union([z.string().transform((val) => Number(val)), z.number()]),
})

export default defineApi(
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
        errorMessage: 'Failed to post bookmark.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
