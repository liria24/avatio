import database from '@@/database'
import { feedbacks } from '@@/database/schema'

const body = feedbacksInsertSchema.pick({
    comment: true,
})

export default defineApi(
    async (session) => {
        const { comment } = await validateBody(body, { sanitize: true })

        await database.insert(feedbacks).values({
            userId: session.user.id,
            comment,
        })

        return null
    },
    {
        errorMessage: 'Failed to post feedback.',
        requireSession: true,
    }
)
