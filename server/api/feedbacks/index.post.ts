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
        binding: 'RATE_LIMIT_USER_ACTION',
        key: `feedback:${fingerprint}`,
    })

    await db.insert(feedbacks).values({
        fingerprint,
        comment,
        contextPath,
    })

    logger('feedback').log(`Feedback created: ${fingerprint}`)

    return null
})
