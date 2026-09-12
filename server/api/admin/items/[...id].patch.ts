import { catalogItems } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

export default promiseEventHandler(async ({ event, db }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { id } = await validateParams(z.object({ id: z.string().min(1) }))
    const { categoryOverride } = await validateBody(
        z.object({ categoryOverride: itemCategorySchema.nullable() }),
        { sanitize: true },
    )
    const [updated] = await db
        .update(catalogItems)
        .set({
            categoryOverride,
            categoryOverrideOrigin: categoryOverride ? 'manual' : null,
        })
        .where(
            and(
                eq(catalogItems.id, id),
                categoryOverride ? undefined : eq(catalogItems.categoryOverrideOrigin, 'manual'),
            ),
        )
        .returning({ id: catalogItems.id })
    if (!updated) {
        const item = await queryAdminCatalogItem(db, id)
        if (!item) throw serverError.notFound()
        return item
    }
    await invalidateCacheResources(
        event,
        { items: [id], collections: [EDGE_CACHE_TAGS.items] },
        'admin item category update',
    )
    return queryAdminCatalogItem(db, id)
})
