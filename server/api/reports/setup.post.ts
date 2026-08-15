import { setupReports } from '@@/database/schema'

const body = setupReportsInsertSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `reports:${session.user.id}`,
        })

        const { setupId, spam, hate, infringe, badImage, other, comment } = await validateBody(
            body,
            { sanitize: true },
        )

        const requestBody = { setupId, spam, hate, infringe, badImage, other, comment }
        const idempotency = await claimIdempotencyRequest({
            event,
            db,
            scope: `user:${session.user.id}`,
            route: '/api/reports/setup',
            body: requestBody,
        })
        if (idempotency.replay) return idempotency.response

        await executeD1Batch(db, [
            db.insert(setupReports).values({
                reporterId: session.user.id,
                setupId,
                spam,
                hate,
                infringe,
                badImage,
                other,
                comment,
                idempotencyRequestId: idempotency.id,
            }),
            completeIdempotencyRequest(db, idempotency, null),
        ])

        return null
    },
    {
        rejectBannedUser: true,
    },
)
