import { setupDraftImages, setupDrafts } from '@@/database/schema'
import { eq, sql } from 'drizzle-orm'

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

        if (!id && !hasContent(content)) return null

        if (id && !hasContent(content)) {
            await db.delete(setupDrafts).where(eq(setupDrafts.id, id))
            return null
        }

        const result = await db.transaction(async (tx) => {
            const [upserted] = await tx
                .insert(setupDrafts)
                .values({
                    id,
                    userId: session.user.id,
                    setupId,
                    content,
                })
                .onConflictDoUpdate({
                    target: setupDrafts.id,
                    set: {
                        updatedAt: new Date(),
                        setupId,
                        content,
                    },
                })
                .returning({
                    id: setupDrafts.id,
                })

            if (!upserted) throw serverError.internalServerError()

            const images = (content.images || []).map((url) => {
                const objectKey = content.imageMetadata?.[url]?.objectKey
                if (!objectKey)
                    throw serverError.badRequest({
                        responseMessage: 'Image metadata is required for uploaded setup images.',
                    })

                return {
                    setupDraftId: upserted.id,
                    objectKey,
                }
            })

            await Promise.all([
                tx.delete(setupDraftImages).where(eq(setupDraftImages.setupDraftId, upserted.id)),
                ...(images.length ? [tx.insert(setupDraftImages).values(images)] : []),
            ])

            return upserted
        })

        return { draftId: result.id }
    },
    {
        rejectBannedUser: true,
    },
)
