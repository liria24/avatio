import { z } from 'zod'

const paramsSchema = z.object({ id: z.string() })
const bodySchema = setupsUpdateSchema

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const { id } = await validateParams(paramsSchema)
        const input = await validateBody(bodySchema)
        const includeItemPoints = await canUseSetupItemPoints(event, session.user)
        if (!includeItemPoints && input.points !== undefined) throw serverError.forbidden()
        return updateSetup({ event, db, user: session.user, includeItemPoints }, id, input)
    },
    { rejectBannedUser: true },
)
