import { setupDraftImages, setupDrafts } from '@@/database/schema'
import { and, eq, sql } from 'drizzle-orm'

const body = setupDraftsInsertSchema.pick({
    id: true,
    setupId: true,
    content: true,
})

const hasContent = (content: Record<string, unknown>) =>
    Object.values(content).some((value) => {
        if (value === null || value === undefined) return false
        if (Array.isArray(value)) return value.length > 0
        if (typeof value === 'object') return Object.keys(value).length > 0
        if (typeof value === 'string') return value.length > 0
        return true
    })

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const { id, setupId, content } = await validateBody(body, {
            sanitize: true,
        })
        await enforceRateLimit({
            scope: 'setups:drafts:save',
            identity: session.user.id,
            limit: 120,
            windowSeconds: 60,
        })

        if (!id && !hasContent(content)) return null

        const existingDraft = id
            ? await db.query.setupDrafts.findFirst({
                  where: {
                      id: { eq: id },
                      userId: { eq: session.user.id },
                  },
                  columns: {
                      id: true,
                  },
              })
            : null

        if (id && !existingDraft) throw serverError.notFound()

        if (id && !hasContent(content)) {
            await db
                .delete(setupDrafts)
                .where(and(eq(setupDrafts.id, id), eq(setupDrafts.userId, session.user.id)))
            return null
        }

        if (!existingDraft) {
            const userSetupDraftsCount = await db.query.setupDrafts.findMany({
                where: {
                    userId: { eq: session.user.id },
                },
                columns: {
                    id: true,
                },
                extras: {
                    count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
                },
            })

            if ((userSetupDraftsCount[0]?.count || 0) >= MAX_SETUP_DRAFTS)
                throw serverError.badRequest({
                    responseMessage: 'You have reached the maximum number of setup drafts allowed.',
                })
        }

        const result = await db.transaction(async (tx) => {
            const [saved] = existingDraft
                ? await tx
                      .update(setupDrafts)
                      .set({
                          updatedAt: new Date(),
                          setupId,
                          content,
                      })
                      .where(and(eq(setupDrafts.id, id!), eq(setupDrafts.userId, session.user.id)))
                      .returning({
                          id: setupDrafts.id,
                      })
                : await tx
                      .insert(setupDrafts)
                      .values({
                          userId: session.user.id,
                          setupId,
                          content,
                      })
                      .returning({
                          id: setupDrafts.id,
                      })

            if (!saved) throw serverError.internalServerError()

            const images = (content.images || []).map((url) => {
                const objectKey = content.imageMetadata?.[url]?.objectKey
                if (!objectKey)
                    throw serverError.badRequest({
                        responseMessage: 'Image metadata is required for uploaded setup images.',
                    })

                return {
                    setupDraftId: saved.id,
                    objectKey,
                }
            })

            await Promise.all([
                tx.delete(setupDraftImages).where(eq(setupDraftImages.setupDraftId, saved.id)),
                ...(images.length ? [tx.insert(setupDraftImages).values(images)] : []),
            ])

            return saved
        })

        return { draftId: result.id }
    },
    {
        rejectBannedUser: true,
    },
)
