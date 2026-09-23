import { catalogItems } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default promiseEventHandler(async ({ event, db }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { id } = await validateParams(z.object({ id: z.string().min(1) }))
    const { displayNameOverride } = await validateBody(
        z.object({ displayNameOverride: z.string().max(200).nullable() }),
        { sanitize: true },
    )
    const [item] = await db
        .update(catalogItems)
        .set({ displayNameOverride })
        .where(eq(catalogItems.id, id))
        .returning({ id: catalogItems.id })
    if (!item) throw serverError.notFound()
    await invalidateCacheResources(
        event,
        { items: [id], collections: [EDGE_CACHE_TAGS.items] },
        'admin item name update',
    )
    return queryCatalogItem(db, id)
})
