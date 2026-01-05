import { setupReports } from '@@/database/schema'

const body = setupReportsInsertSchema

export default defineApi(
    async ({ session }) => {
        const { setupId, spam, hate, infringe, badImage, other, comment } =
            await validateBody(body, { sanitize: true })

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
        errorMessage: 'Failed to report setup.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
