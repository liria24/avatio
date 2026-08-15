import { userReports } from '@@/database/schema'

const body = userReportsInsertSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `reports:${session.user.id}`,
        })

        const { reporteeId, spam, hate, infringe, badImage, other, comment } = await validateBody(
            body,
            { sanitize: true },
        )

        const requestBody = { reporteeId, spam, hate, infringe, badImage, other, comment }
        const idempotency = await claimIdempotencyRequest({
            event,
            db,
            scope: `user:${session.user.id}`,
            route: '/api/reports/user',
            body: requestBody,
        })
        if (idempotency.replay) return idempotency.response

        await executeD1Batch(db, [
            db.insert(userReports).values({
                reporterId: session.user.id,
                reporteeId,
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
