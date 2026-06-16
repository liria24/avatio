import { feedbacks } from '@@/database/schema'

const body = feedbacksInsertSchema.pick({
    comment: true,
    contextPath: true,
})

export default promiseEventHandler(async ({ db }) => {
    const { comment, contextPath } = await validateBody(body, {
        sanitize: true,
    })

    const fingerprint = await getFingerprint()
    await enforceRateLimit({
        scope: 'feedback:create',
        identity: fingerprint,
        limit: 5,
        windowSeconds: 10 * 60,
    })

    await db.insert(feedbacks).values({
        fingerprint,
        comment,
        contextPath,
    })

    logger('feedback').log(`Feedback created: ${fingerprint}`)

    return null
})
