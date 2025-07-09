import database from '@@/database'
import { setupReports } from '@@/database/schema'

const body = setupReportsInsertSchema.pick({
    setupId: true,
    spam: true,
    hate: true,
    infringe: true,
    badImage: true,
    other: true,
    comment: true,
})

export default defineApi(
    async ({ session }) => {
        const { setupId, spam, hate, infringe, badImage, other, comment } =
            await validateBody(body, { sanitize: true })

        await database.insert(setupReports).values({
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
