import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const { id } = await validateParams(params)
        const bookmark = await db.query.bookmarks.findFirst({
            where: {
                userId: { eq: session.user.id },
                setupId: { eq: id },
                setup: {
                    hidAt: { isNull: true },
                    OR: [{ public: { eq: true } }, { userId: { eq: session.user.id } }],
                    user: { OR: [{ banned: { eq: false } }, { banned: { isNull: true } }] },
                },
            },
            columns: { id: true },
        })

        return { bookmarked: Boolean(bookmark) }
    },
    { rejectBannedUser: true },
)
