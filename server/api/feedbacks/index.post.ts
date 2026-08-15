import { feedbacks } from '@@/database/schema'

const body = feedbacksInsertSchema.pick({
    comment: true,
    contextPath: true,
})

export default promiseEventHandler(async ({ event, db }) => {
    const { comment, contextPath } = await validateBody(body, {
        sanitize: true,
    })

    const fingerprint = await getFingerprint()
    await enforceRateLimit({
        binding: 'RATE_LIMIT_USER_ACTION',
        key: `feedback:${fingerprint}`,
    })

    const requestBody = { comment, contextPath }
    const idempotency = await claimIdempotencyRequest({
        event,
        db,
        scope: `fingerprint:${fingerprint}`,
        route: '/api/feedbacks',
        body: requestBody,
    })
    if (idempotency.replay) return idempotency.response

    await executeD1Batch(db, [
        db.insert(feedbacks).values({
            fingerprint,
            comment,
            contextPath,
            idempotencyRequestId: idempotency.id,
        }),
        completeIdempotencyRequest(db, idempotency, null),
    ])

    logger('feedback').log(`Feedback created: ${fingerprint}`)

    return null
})
