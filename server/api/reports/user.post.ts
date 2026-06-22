import { userReports } from '@@/database/schema'

const body = userReportsInsertSchema

export default authedSessionEventHandler(
    async ({ session, db }) => {
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `reports:${session.user.id}`,
        })

        const { reporteeId, spam, hate, infringe, badImage, other, comment } = await validateBody(
            body,
            { sanitize: true },
        )

        await db.insert(userReports).values({
            reporterId: session.user.id,
            reporteeId,
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
