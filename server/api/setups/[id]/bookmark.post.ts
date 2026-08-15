import { bookmarks } from '@@/database/schema'
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
        const setup = await db.query.setups.findFirst({
            where: {
                id: { eq: id },
                hidAt: { isNull: true },
                user: {
                    OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                },
            },
            columns: {
                id: true,
                userId: true,
                public: true,
            },
        })

        if (!setup) throw serverError.notFound()
        if (!setup.public && setup.userId !== session.user.id) throw serverError.notFound()

        await db
            .insert(bookmarks)
            .values({
                setupId: id,
                userId: session.user.id,
            })
            .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.setupId] })

        return null
    },
    {
        rejectBannedUser: true,
    },
)
