import { catalogItems } from '@@/database/schema'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional(),
    manualCategoryOverride: z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional()
        .default(false),
    providerKey: z.string().optional(),
    availability: z
        .union([
            z.enum(['available', 'withdrawn', 'policy_rejected', 'unknown']),
            z.enum(['available', 'withdrawn', 'policy_rejected', 'unknown']).array(),
        ])
        .optional(),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { q, orderBy, sort, page, limit, manualCategoryOverride, providerKey, availability } =
        await validateQuery(query)

    applyNoStoreCache(event)
    const result = await queryCatalogItems(db, {
        q,
        orderBy,
        sort,
        page,
        limit: limit ?? API_LIMIT_MAX,
        manualCategoryOverride,
        providerKey,
        availability: availability
            ? Array.isArray(availability)
                ? availability
                : [availability]
            : undefined,
    })
    const overrides = result.data.length
        ? await db
              .select({
                  id: catalogItems.id,
                  category: catalogItems.categoryOverride,
                  origin: catalogItems.categoryOverrideOrigin,
              })
              .from(catalogItems)
              .where(
                  inArray(
                      catalogItems.id,
                      result.data.map(({ id }) => id),
                  ),
              )
        : []
    const overrideById = new Map(
        overrides.map(({ id, category, origin }) => [id, origin === 'manual' ? category : null]),
    )
    return {
        ...result,
        data: result.data.map((item) => ({
            ...item,
            manualCategoryOverride: overrideById.get(item.id) ?? null,
        })),
    }
})
