import { itemReports } from '@@/database/schema'

const body = itemReportsInsertSchema

export default authedSessionEventHandler(
    async ({ session, db }) => {
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `reports:${session.user.id}`,
        })

        const { itemId, nameError, irrelevant, other, comment } = await validateBody(body, {
            sanitize: true,
        })

        await db.insert(itemReports).values({
            reporterId: session.user.id,
            itemId,
            nameError,
            irrelevant,
            other,
            comment,
        })

        return null
    },
    {
        rejectBannedUser: true,
    },
)
