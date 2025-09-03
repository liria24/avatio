import database from '@@/database'
import { setupDraftImages, setupDrafts } from '@@/database/schema'
import { waitUntil } from '@vercel/functions'
import { count, eq } from 'drizzle-orm'

const body = setupDraftsInsertSchema.pick({
    id: true,
    setupId: true,
    content: true,
})

const refreshDraftImages = async (draftId: string, imageUrls: string[]) => {
    await database
        .delete(setupDraftImages)
        .where(eq(setupDraftImages.setupDraftId, draftId))
    const images = imageUrls.map((url) => ({
        setupDraftId: draftId,
        url,
    }))
    if (images.length) await database.insert(setupDraftImages).values(images)
}

export default defineApi(
    async ({ session }) => {
        const { id, setupId, content } = await validateBody(body, {
            sanitize: true,
        })

        const userSetupDraftsCount = await database
            .select({ count: count() })
            .from(setupDrafts)
            .where(eq(setupDrafts.userId, session.user.id))
            .execute()

        if (userSetupDraftsCount[0].count >= 32)
            throw createError({
                statusCode: 429,
                message:
                    'You have reached the maximum number of setup drafts allowed.',
            })

        if (!id && !Object.keys(content).length) return null

        if (id && !Object.keys(content).length) {
            await database.delete(setupDrafts).where(eq(setupDrafts.id, id))
            return null
        }

        const result = await database
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

        waitUntil(refreshDraftImages(result[0].id, content.images || []))

        return { draftId: result[0].id }
    },
    {
        errorMessage: 'Failed to post setup draft.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
