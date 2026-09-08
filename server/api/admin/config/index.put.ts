import { allowedBoothCategories, catalogItems } from '@@/database/schema'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

const configSchema = z.object({
    allowedBoothCategoryId: z
        .number()
        .int()
        .array()
        .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
    catalogCategoryOverrides: z.record(z.string().min(1), itemCategorySchema),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const config = await validateBody(configSchema, { sanitize: true })
    const ids = Object.keys(config.catalogCategoryOverrides)
    const [existing, targets] = await Promise.all([
        db
            .select({ id: catalogItems.id })
            .from(catalogItems)
            .where(eq(catalogItems.categoryOverrideOrigin, 'manual')),
        ids.length
            ? db
                  .select({ id: catalogItems.id })
                  .from(catalogItems)
                  .where(inArray(catalogItems.id, ids))
            : [],
    ])
    if (targets.length !== ids.length)
        throw serverError.badRequest({ responseMessage: 'Unknown CatalogItem ID.' })
    const queries: Parameters<typeof executeD1Batch>[1] = [
        db.delete(allowedBoothCategories),
        db
            .update(catalogItems)
            .set({ categoryOverride: null, categoryOverrideOrigin: null })
            .where(eq(catalogItems.categoryOverrideOrigin, 'manual')),
    ]
    if (config.allowedBoothCategoryId.length)
        queries.push(
            db
                .insert(allowedBoothCategories)
                .values(config.allowedBoothCategoryId.map((categoryId) => ({ categoryId }))),
        )
    for (const [id, category] of Object.entries(config.catalogCategoryOverrides))
        queries.push(
            db
                .update(catalogItems)
                .set({ categoryOverride: category, categoryOverrideOrigin: 'manual' })
                .where(eq(catalogItems.id, id)),
        )
    await executeD1Batch(db, queries)
    await invalidateCacheResources(
        event,
        {
            items: [...new Set([...ids, ...existing.map((item) => item.id)])],
            collections: [EDGE_CACHE_TAGS.items],
        },
        'catalog configuration update',
    )
    return readAppConfig(db, event)
})
