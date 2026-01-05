import { userReports } from '@@/database/schema'

const body = userReportsInsertSchema.pick({
    reporteeId: true,
    spam: true,
    hate: true,
    infringe: true,
    badImage: true,
    other: true,
    comment: true,
})

export default defineApi(
    async ({ session }) => {
        const { reporteeId, spam, hate, infringe, badImage, other, comment } = await validateBody(
            body,
            { sanitize: true }
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
        errorMessage: 'Failed to report user.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
