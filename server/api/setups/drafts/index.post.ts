import database from '@@/database'
import { setupDrafts } from '@@/database/schema'
import { count, eq } from 'drizzle-orm'

const body = setupDraftsInsertSchema.pick({
    id: true,
    setupId: true,
    content: true,
})

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

        return { draftId: result[0].id }
    },
    {
        errorMessage: 'Failed to post setup draft.',
        requireSession: true,
        rejectBannedUser: true,
    }
)
