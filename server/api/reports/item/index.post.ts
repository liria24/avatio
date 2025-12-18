import { itemReports } from '@@/database/schema'

const body = itemReportsInsertSchema.pick({
    itemId: true,
    nameError: true,
    irrelevant: true,
    other: true,
    comment: true,
})

export default defineApi(
    async ({ session }) => {
        const { itemId, nameError, irrelevant, other, comment } =
            await validateBody(body, { sanitize: true })

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
        errorMessage: 'Failed to report item.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
