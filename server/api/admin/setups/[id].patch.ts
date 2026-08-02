import { setups } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})
const body = z.object({
    hide: z.union([z.boolean(), z.stringbool()]).optional(),
    hideReason: z.string().optional(),
})

export default adminSessionEventHandler(async ({ event, db }) => {
    const { id } = await validateParams(params)
    const { hide, hideReason } = await validateBody(body)

    if (hide !== undefined)
        await db
            .update(setups)
            .set({
                hidAt: hide ? new Date() : null,
                hidReason: hide ? hideReason || null : null,
            })
            .where(eq(setups.id, id))

    await purgeEdgeCacheTags(
        event,
        [getSetupCacheTag(id), EDGE_CACHE_TAGS.popularAvatars, EDGE_CACHE_TAGS.setups],
        'admin setup visibility update',
    )

    return null
})
