import {
    allowedBoothCategories,
    catalogItems,
    itemCategoryOverrides,
    itemSources,
} from '@@/database/schema'
import { or, sql } from 'drizzle-orm'
import { z } from 'zod'

const itemCategorySchema = z.enum([
    'avatar',
    'clothing',
    'accessory',
    'hair',
    'shader',
    'texture',
    'tool',
    'other',
])

const configSchema = z.object({
    allowedBoothCategoryId: z
        .number()
        .int()
        .array()
        .transform((ids) => [...new Set(ids)].sort((a, b) => a - b))
        .default([]),
    specificItemCategories: z
        .object({
            booth: z.record(z.string(), itemCategorySchema).default({}),
            github: z.record(z.string(), itemCategorySchema).default({}),
        })
        .default({ booth: {}, github: {} }),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const config = await validateBody(configSchema, { sanitize: true })
    const existingOverrides = await db.select().from(itemCategoryOverrides)
    const queries = [
        db.delete(allowedBoothCategories),
        db.delete(itemCategoryOverrides),
    ] as Parameters<typeof executeD1Batch>[1]

    if (config.allowedBoothCategoryId.length)
        queries.push(
            db
                .insert(allowedBoothCategories)
                .values(config.allowedBoothCategoryId.map((categoryId) => ({ categoryId }))),
        )

    const rows = (['booth', 'github'] as const).flatMap((platform) =>
        Object.entries(config.specificItemCategories[platform]).map(([itemId, category]) => ({
            platform,
            itemId,
            category,
        })),
    )
    if (rows.length) queries.push(db.insert(itemCategoryOverrides).values(rows))

    // Keep the v2 Avatio override layer aligned with the temporary legacy admin
    // contract. A single correlated update avoids one D1 batch statement per item.
    queries.push(
        db
            .update(catalogItems)
            .set({
                categoryOverride: sql<ItemCategory>`CASE
                    WHEN EXISTS (
                        SELECT 1 FROM item_sources source
                        JOIN item_category_overrides override
                          ON override.platform = source.provider_key
                         AND override.item_id = source.external_id
                        WHERE source.item_id = ${catalogItems.id}
                    ) THEN (
                        SELECT override.category FROM item_sources source
                        JOIN item_category_overrides override
                          ON override.platform = source.provider_key
                         AND override.item_id = source.external_id
                        WHERE source.item_id = ${catalogItems.id}
                        ORDER BY source."primary" DESC LIMIT 1
                    )
                    ELSE (
                        SELECT legacy.category FROM item_sources source
                        JOIN items legacy
                          ON legacy.platform = source.provider_key
                         AND legacy.id = source.external_id
                        WHERE source.item_id = ${catalogItems.id}
                        ORDER BY source."primary" DESC LIMIT 1
                    )
                END`,
                categoryOverrideOrigin: sql<'manual' | 'legacy' | null>`CASE
                    WHEN EXISTS (
                        SELECT 1 FROM item_sources source
                        JOIN item_category_overrides override
                          ON override.platform = source.provider_key
                         AND override.item_id = source.external_id
                        WHERE source.item_id = ${catalogItems.id}
                    ) THEN 'manual'
                    WHEN EXISTS (
                        SELECT 1 FROM item_sources source
                        JOIN items legacy
                          ON legacy.platform = source.provider_key
                         AND legacy.id = source.external_id
                        WHERE source.item_id = ${catalogItems.id}
                    ) THEN 'legacy'
                    ELSE NULL
                END`,
            })
            .where(
                or(
                    sql`${catalogItems.categoryOverrideOrigin} = 'manual'`,
                    sql`EXISTS (
                        SELECT 1 FROM item_sources source
                        JOIN item_category_overrides override
                          ON override.platform = source.provider_key
                         AND override.item_id = source.external_id
                        WHERE source.item_id = ${catalogItems.id}
                    )`,
                ),
            ),
    )

    await executeD1Batch(db, queries)
    const affected = new Set(
        [...existingOverrides, ...rows].map(({ platform, itemId }) => `${platform}\u0000${itemId}`),
    )
    const affectedCatalogItems = (
        await db
            .select({
                itemId: itemSources.itemId,
                providerKey: itemSources.providerKey,
                externalId: itemSources.externalId,
            })
            .from(itemSources)
    )
        .filter((source) => affected.has(`${source.providerKey}\u0000${source.externalId}`))
        .map(({ itemId }) => itemId)
    await invalidateCacheResources(
        event,
        {
            items: [...new Set(affectedCatalogItems)],
            collections: [EDGE_CACHE_TAGS.items],
        },
        'catalog configuration update',
    )
    return readAppConfig(db, event)
})
