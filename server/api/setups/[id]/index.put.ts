import { z } from 'zod'

const paramsSchema = z.object({ id: z.string() })
const bodySchema = setupsUpdateSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const { id } = await validateParams(paramsSchema)
        const input = await validateBody(bodySchema)
        return updateSetup(
            { event, db, user: { id: session.user.id, role: session.user.role } },
            id,
            input,
        )
    },
    { rejectBannedUser: true },
)
