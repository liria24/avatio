import { setupDraftContentSchema } from '@avatio/core/setups'
import { z } from 'zod'

const querySchema = z.object({ setupId: z.string().optional() })

export default authedSessionEventHandler<SetupDraftSummary[]>(
    async ({ session, db }) => {
        const { setupId } = await validateQuery(querySchema)
        const drafts = await db.query.setupDrafts.findMany({
            where: {
                userId: { eq: session.user.id },
                setupId: setupId ? { eq: setupId } : undefined,
            },
            columns: {
                id: true,
                createdAt: true,
                updatedAt: true,
                setupId: true,
                revision: true,
                content: true,
            },
            orderBy: { updatedAt: 'desc' },
            limit: MAX_SETUP_DRAFTS,
        })

        return drafts.map(({ content, ...draft }) => {
            const parsed = setupDraftContentSchema.parse(content)
            return {
                ...draft,
                name: parsed.name,
                description: parsed.description,
                itemCount: parsed.items.length,
            }
        })
    },
    { rejectBannedUser: true },
)
