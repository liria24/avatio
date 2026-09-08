import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    category: z
        .union([itemCategorySchema, itemCategorySchema.array()])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional().default(ITEMS_API_DEFAULT_LIMIT),
})

export default promiseEventHandler<PaginationResponse<CatalogItemView[]>>(async ({ event, db }) => {
    const { q, orderBy, sort, category, page, limit } = await validateQuery(query)

    const result = await queryCatalogItems(db, {
        q,
        orderBy,
        sort,
        category,
        page,
        limit,
        availability: ['available'],
    })
    applyPublicEdgeCache(event, [EDGE_CACHE_TAGS.items])
    return result
})
