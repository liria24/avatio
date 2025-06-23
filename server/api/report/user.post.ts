import database from '@@/database'
import { userReports } from '@@/database/schema'

const body = userReportsInsertSchema

export default defineApi(
    async (session) => {
        const { reporteeId, spam, hate, infringe, badImage, other, comment } =
            await validateBody(body, { sanitize: true })

        await database.insert(userReports).values({
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
        errorMessage: 'Failed to report user.',
        requireSession: true,
    }
)
