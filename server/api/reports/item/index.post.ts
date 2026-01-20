import { itemReports } from '@@/database/schema'

const body = itemReportsInsertSchema

export default authedSessionEventHandler(
    async ({ session }) => {
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
    }
)
