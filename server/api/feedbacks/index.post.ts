import { feedbacks } from '@@/database/schema'

const body = feedbacksInsertSchema.pick({
    comment: true,
    contextPath: true,
})

export default defineEventHandler(async () => {
    const { comment, contextPath } = await validateBody(body, {
        sanitize: true,
    })

    const fingerprint = await getFingerprint()

    await db.insert(feedbacks).values({
        fingerprint,
        comment,
        contextPath,
    })

    logger('feedback').log(`Feedback created: ${fingerprint}`)

    return null
})
