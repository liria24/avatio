import { setupReports } from '@@/database/schema'

const body = setupReportsInsertSchema

export default authedSessionEventHandler(
    async ({ session, db }) => {
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `reports:${session.user.id}`,
        })

        const { setupId, spam, hate, infringe, badImage, other, comment } = await validateBody(
            body,
            { sanitize: true },
        )

        await db.insert(setupReports).values({
            reporterId: session.user.id,
            setupId,
            spam,
            hate,
            infringe,
            badImage,
            other,
            comment,
        })

        return null
    },
    {
        rejectBannedUser: true,
    },
)
