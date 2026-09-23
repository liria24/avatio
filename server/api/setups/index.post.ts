const bodySchema = setupsInsertSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const input = await validateBody(bodySchema, { sanitize: true })
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `setups:${session.user.id}`,
        })

        const generatedSetupId = await generateNewSetupId(db)
        const idempotency = await claimIdempotencyRequest({
            event,
            db,
            scope: `user:${session.user.id}`,
            route: '/api/setups',
            body: input,
            resourceId: generatedSetupId,
        })
        if (idempotency.replay) {
            if (!idempotency.resourceId) throw serverError.internalServerError()
            const projection = await querySetupProjection(db, idempotency.resourceId, {
                userId: session.user.id,
                role: session.user.role,
            })
            if (!projection) throw serverError.internalServerError()
            return projection.setup
        }

        return createSetup(
            { event, db, user: { id: session.user.id, role: session.user.role } },
            input,
            idempotency.resourceId ?? generatedSetupId,
            idempotency,
        )
    },
    { rejectBannedUser: true },
)
