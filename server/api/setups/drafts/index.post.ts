import { setupDraftImages, setupDrafts } from '@@/database/schema'
import { waitUntil } from '@vercel/functions'
import { eq, sql } from 'drizzle-orm'

const body = setupDraftsInsertSchema.pick({
    id: true,
    setupId: true,
    content: true,
})

const refreshDraftImages = async (draftId: string, imageUrls: string[]) => {
    await db.delete(setupDraftImages).where(eq(setupDraftImages.setupDraftId, draftId))
    const images = imageUrls.map((url) => ({
        setupDraftId: draftId,
        url,
    }))
    if (images.length) await db.insert(setupDraftImages).values(images)
}

const hasContent = (content: Record<string, unknown>) =>
    Object.values(content).some((value) => {
        if (value === null || value === undefined) return false
        if (Array.isArray(value)) return value.length > 0
        if (typeof value === 'object') return Object.keys(value).length > 0
        if (typeof value === 'string') return value.length > 0
        return true
    })

export default authedSessionEventHandler(
    async ({ session }) => {
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
            throw createError({
                status: 429,
                statusText: 'You have reached the maximum number of setup drafts allowed.',
            })

        if (!id && !hasContent(content)) return null

        if (id && !hasContent(content)) {
            await db.delete(setupDrafts).where(eq(setupDrafts.id, id))
            return null
        }

        const [result] = await db
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

        if (!result)
            throw createError({
                status: 500,
                statusText: 'Failed to create draft',
            })

        waitUntil(refreshDraftImages(result.id, content.images || []))

        return { draftId: result.id }
    },
    {
        rejectBannedUser: true,
    }
)
