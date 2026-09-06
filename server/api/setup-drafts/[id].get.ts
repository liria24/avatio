import { setupDraftContentSchema } from '@avatio/core/setups'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })

export default authedSessionEventHandler<SetupDraft>(
    async ({ session, db }) => {
        const { id } = await validateParams(paramsSchema)
        const draft = await db.query.setupDrafts.findFirst({
            where: { id: { eq: id }, userId: { eq: session.user.id } },
            columns: {
                id: true,
                createdAt: true,
                updatedAt: true,
                setupId: true,
                revision: true,
                content: true,
            },
        })
        if (!draft) throw serverError.notFound()
        return { ...draft, content: setupDraftContentSchema.parse(draft.content) }
    },
    { rejectBannedUser: true },
)
