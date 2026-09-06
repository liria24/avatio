import { setupDraftImages, setupDrafts } from '@@/database/schema'
import { isEmptySetupComposeForm } from '@avatio/core/setups'
import { and, eq, exists, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })
const bodySchema = setupDraftsUpdateSchema

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const [{ id }, { expectedRevision, setupId, content }] = await Promise.all([
            validateParams(paramsSchema),
            validateBody(bodySchema, { sanitize: true }),
        ])
        await enforceRateLimit({ binding: 'RATE_LIMIT_DRAFT', key: `drafts:${session.user.id}` })

        const existing = await db.query.setupDrafts.findFirst({
            where: { id: { eq: id }, userId: { eq: session.user.id } },
            columns: { id: true, revision: true },
        })

        if (isEmptySetupComposeForm(content)) {
            if (!existing) {
                if (expectedRevision !== 0) throw serverError.conflict()
                return null
            }
            const [deleted] = await db
                .delete(setupDrafts)
                .where(
                    and(
                        eq(setupDrafts.id, id),
                        eq(setupDrafts.userId, session.user.id),
                        eq(setupDrafts.revision, expectedRevision),
                    ),
                )
                .returning({ id: setupDrafts.id })
            if (!deleted) throw serverError.conflict()
            return null
        }

        const images = content.images.map((url) => {
            const objectKey = content.imageMetadata?.[url]?.objectKey
            if (!objectKey)
                throw serverError.badRequest({
                    responseMessage: 'Image metadata is required for uploaded setup images.',
                })
            return objectKey
        })

        if (!existing) {
            if (expectedRevision !== 0) throw serverError.conflict()
            const drafts = await db.query.setupDrafts.findMany({
                where: { userId: { eq: session.user.id } },
                columns: { id: true },
                limit: MAX_SETUP_DRAFTS,
            })
            if (drafts.length >= MAX_SETUP_DRAFTS)
                throw serverError.badRequest({
                    responseMessage: 'You have reached the maximum number of setup drafts allowed.',
                })

            const queries: BatchItem<'sqlite'>[] = [
                db.insert(setupDrafts).values({
                    id,
                    userId: session.user.id,
                    setupId,
                    revision: 1,
                    content,
                }),
                ...images.map((objectKey) =>
                    db.insert(setupDraftImages).values({
                        id: crypto.randomUUID(),
                        setupDraftId: id,
                        objectKey,
                    }),
                ),
            ]
            await executeD1Batch(db, queries)
            return { id, revision: 1 }
        }

        if (existing.revision !== expectedRevision) throw serverError.conflict()
        const revision = expectedRevision + 1
        const now = new Date()
        const currentSave = and(
            eq(setupDrafts.id, id),
            eq(setupDrafts.userId, session.user.id),
            eq(setupDrafts.revision, revision),
            eq(setupDrafts.content, content),
        )
        const queries: BatchItem<'sqlite'>[] = [
            db
                .update(setupDrafts)
                .set({ setupId, content, revision, updatedAt: now })
                .where(
                    and(
                        eq(setupDrafts.id, id),
                        eq(setupDrafts.userId, session.user.id),
                        eq(setupDrafts.revision, expectedRevision),
                    ),
                )
                .returning({ id: setupDrafts.id }),
            db
                .delete(setupDraftImages)
                .where(
                    and(
                        eq(setupDraftImages.setupDraftId, id),
                        exists(
                            db.select({ id: setupDrafts.id }).from(setupDrafts).where(currentSave),
                        ),
                    ),
                ),
            ...images.map((objectKey) =>
                db.insert(setupDraftImages).select(
                    db
                        .select({
                            id: sql<string>`${crypto.randomUUID()}`.as('id'),
                            setupDraftId: setupDrafts.id,
                            objectKey: sql<string>`${objectKey}`.as('object_key'),
                        })
                        .from(setupDrafts)
                        .where(currentSave),
                ),
            ),
        ]
        const [updated] = await executeD1Batch(db, queries)
        if (!(updated as { id: string }[] | undefined)?.[0]) throw serverError.conflict()
        return { id, revision }
    },
    { rejectBannedUser: true },
)
