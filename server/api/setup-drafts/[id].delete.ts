import { setupDrafts } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const { id } = await validateParams(paramsSchema)
        const [deleted] = await db
            .delete(setupDrafts)
            .where(and(eq(setupDrafts.id, id), eq(setupDrafts.userId, session.user.id)))
            .returning({ id: setupDrafts.id })
        if (!deleted) throw serverError.notFound()
        return { success: true }
    },
    { rejectBannedUser: true },
)
