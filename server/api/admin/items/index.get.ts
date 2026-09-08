import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional(),
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
    const { q, orderBy, sort, limit, providerKey, availability } = await validateQuery(query)

    applyNoStoreCache(event)
    const result = await queryCatalogItems(db, {
        q,
        orderBy,
        sort,
        limit: limit ?? API_LIMIT_MAX,
        providerKey,
        availability: availability
            ? Array.isArray(availability)
                ? availability
                : [availability]
            : undefined,
    })
    return result.data
})
