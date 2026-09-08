import { z } from 'zod'

export default authedSessionEventHandler(
    async ({ event, db, session }) => {
        const { reference } = await validateBody(
            z.object({ reference: z.string().trim().min(1).max(2048) }),
            { sanitize: true },
        )
        applyNoStoreCache(event)
        return resolveCatalogReference(event, db, reference, session.user.id)
    },
    { rejectBannedUser: true },
)
