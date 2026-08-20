import { itemReports } from '@@/database/schema'

const body = itemReportsInsertSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `reports:${session.user.id}`,
        })

        const { itemId, nameError, irrelevant, other, comment } = await validateBody(body, {
            sanitize: true,
        })

        const requestBody = { itemId, nameError, irrelevant, other, comment }
        const idempotency = await claimIdempotencyRequest({
            event,
            db,
            scope: `user:${session.user.id}`,
            route: '/api/reports/item',
            body: requestBody,
        })
        if (idempotency.replay) return idempotency.response

        await executeD1Batch(db, [
            db.insert(itemReports).values({
                reporterId: session.user.id,
                itemId,
                nameError,
                irrelevant,
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
