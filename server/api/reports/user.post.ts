import { userReports } from '@@/database/schema'

const body = userReportsInsertSchema

export default authedSessionEventHandler(
    async ({ session, db }) => {
        await enforceRateLimit({
            scope: 'reports:user:create',
            identity: session.user.id,
            limit: 20,
            windowSeconds: 60 * 60,
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
