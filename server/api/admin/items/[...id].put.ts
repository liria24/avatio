import { catalogItems, items, itemSources } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const body = itemsUpdateSchema.pick({
    niceName: true,
})

export default promiseEventHandler(async ({ event, db }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { id } = await validateParams(params)
    const { niceName } = await validateBody(body, { sanitize: true })

    const [legacyItem] = await db
        .select({ platform: items.platform })
        .from(items)
        .where(eq(items.id, id))
        .limit(1)
    if (!legacyItem) throw serverError.notFound()

    const [source] = await db
        .select({ itemId: itemSources.itemId })
        .from(itemSources)
        .where(
            and(eq(itemSources.providerKey, legacyItem.platform), eq(itemSources.externalId, id)),
        )
        .limit(1)
    const queries: BatchItem<'sqlite'>[] = [
        db.update(items).set({ niceName }).where(eq(items.id, id)),
    ]
    if (source)
        queries.push(
            db
                .update(catalogItems)
                .set({ displayNameOverride: niceName })
                .where(eq(catalogItems.id, source.itemId)),
        )
    await executeD1Batch(db, queries)
    await invalidateCacheResources(
        event,
        {
            items: source ? [source.itemId] : undefined,
            collections: [EDGE_CACHE_TAGS.items],
        },
        'admin item name update',
    )

    const data = await useEvent().$fetch<Item>(`/api/items/${id}`)

    return data
})
