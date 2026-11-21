import { setupDrafts } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })
const querySchema = z.object({
    published: z.string().min(1).optional(),
    preservePoints: z.literal('true').optional(),
})

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const [{ id }, { published, preservePoints }] = await Promise.all([
            validateParams(paramsSchema),
            validateQuery(querySchema),
        ])
        const ownedDraft = and(eq(setupDrafts.id, id), eq(setupDrafts.userId, session.user.id))
        let deletionFilter = ownedDraft
        if (published && !(await canUseSetupItemPoints(event, session.user))) {
            const draft = await db.query.setupDrafts.findFirst({
                where: { id: { eq: id }, userId: { eq: session.user.id } },
                columns: { setupId: true, content: true, revision: true },
            })
            if (!draft) throw serverError.notFound()
            deletionFilter = and(ownedDraft, eq(setupDrafts.revision, draft.revision))
            if (preservePoints || setupDraftContentSchema.parse(draft.content).points.length) {
                const setup = await db.query.setups.findFirst({
                    where: { id: { eq: published }, userId: { eq: session.user.id } },
                    columns: { id: true },
                })
                if (!setup || (draft.setupId && draft.setupId !== published))
                    throw serverError.forbidden()
                const [retained] = await db
                    .update(setupDrafts)
                    .set({
                        setupId: published,
                        revision: draft.revision + 1,
                        updatedAt: new Date(),
                    })
                    .where(deletionFilter)
                    .returning({ revision: setupDrafts.revision })
                if (!retained) throw serverError.conflict()
                return { success: true, retainedRevision: retained.revision }
            }
        }
        const [deleted] = await db
            .delete(setupDrafts)
            .where(deletionFilter)
            .returning({ id: setupDrafts.id })
        if (!deleted)
            throw deletionFilter === ownedDraft ? serverError.notFound() : serverError.conflict()
        return { success: true }
    },
    { rejectBannedUser: true },
)
