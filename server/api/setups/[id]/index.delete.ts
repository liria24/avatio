import { setups } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const { id } = await validateParams(params)

        const data = await db.query.setups.findFirst({
            where: { id: { eq: id } },
            columns: { userId: true, name: true },
        })

        if (!data) throw serverError.notFound()
        if (data.userId !== session.user.id) throw serverError.forbidden()

        const [deleted] = await db
            .delete(setups)
            .where(and(eq(setups.id, id), eq(setups.userId, session.user.id)))
            .returning({ id: setups.id })
        if (!deleted) throw serverError.notFound()

        await purgeEdgeCacheTags(
            event,
            [getSetupCacheTag(id), EDGE_CACHE_TAGS.popularAvatars, EDGE_CACHE_TAGS.setups],
            'setup delete',
        )

        await createAuditLog(db, {
            userId: session.user.id,
            action: 'setup_delete',
            targetType: 'setup',
            targetId: id.toString(),
            details: data.name,
        })

        return null
    },
    {
        rejectBannedUser: true,
    },
)
