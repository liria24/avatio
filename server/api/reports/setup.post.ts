import { setupReports } from '@@/database/schema'

const body = setupReportsInsertSchema

export default authedSessionEventHandler(
    async ({ session, db }) => {
        await enforceRateLimit({
            scope: 'reports:setup:create',
            identity: session.user.id,
            limit: 20,
            windowSeconds: 60 * 60,
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
