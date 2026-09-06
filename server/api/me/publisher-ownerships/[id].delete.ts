import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const { id } = await validateParams(paramsSchema)
        await enforceRateLimit({
            binding: 'RATE_LIMIT_USER_ACTION',
            key: `publisher-ownership-delete:${session.user.id}`,
        })
        if (!(await getPublisherRepository().deleteOwnership(id, session.user.id)))
            throw serverError.notFound()

        await invalidateUserContentCache(event, db, session.user.id, 'publisher ownership removed')
        return { success: true }
    },
    { rejectBannedUser: true },
)
