import { setupDraftImages, setupDrafts } from '@@/database/schema'
import { and, eq, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

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
    async ({ event, session, db }) => {
        const { id, setupId, content } = await validateBody(body, {
            sanitize: true,
        })
        await enforceRateLimit({
            binding: 'RATE_LIMIT_DRAFT',
            key: `drafts:${session.user.id}`,
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

        const generatedDraftId = crypto.randomUUID()
        const idempotency = existingDraft
            ? null
            : await claimIdempotencyRequest({
                  event,
                  db,
                  scope: `user:${session.user.id}`,
                  route: '/api/setups/drafts',
                  body: { setupId, content },
                  resourceId: generatedDraftId,
              })
        if (idempotency?.replay) return idempotency.response

        const draftId = existingDraft ? id! : (idempotency?.resourceId ?? generatedDraftId)
        const images = (content.images || []).map((url) => {
            const objectKey = content.imageMetadata?.[url]?.objectKey
            if (!objectKey)
                throw serverError.badRequest({
                    responseMessage: 'Image metadata is required for uploaded setup images.',
                })

            return {
                setupDraftId: draftId,
                objectKey,
            }
        })
        const saveQuery = existingDraft
            ? db
                  .update(setupDrafts)
                  .set({
                      updatedAt: new Date(),
                      setupId,
                      content,
                  })
                  .where(and(eq(setupDrafts.id, draftId), eq(setupDrafts.userId, session.user.id)))
            : db.insert(setupDrafts).values({
                  id: draftId,
                  userId: session.user.id,
                  setupId,
                  content,
                  idempotencyRequestId: idempotency?.id,
              })
        const queries: BatchItem<'sqlite'>[] = [
            saveQuery,
            db.delete(setupDraftImages).where(eq(setupDraftImages.setupDraftId, draftId)),
        ]
        if (images.length) queries.push(db.insert(setupDraftImages).values(images))
        if (idempotency) queries.push(completeIdempotencyRequest(db, idempotency, { draftId }))

        await executeD1Batch(db, queries)

        return { draftId }
    },
    {
        rejectBannedUser: true,
    },
)
