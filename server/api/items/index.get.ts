import { sql } from 'drizzle-orm'
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
    limit: z.coerce.number().min(1).max(1000).optional().default(64),
})

export default promiseEventHandler<PaginationResponse<Item[]>>(async () => {
    const { q, orderBy, sort, page, limit } = await validateQuery(query)

    const offset = (page - 1) * limit

    const data = await db.query.items.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        limit,
        offset,
        where: {
            outdated: { eq: false },
            name: q ? { ilike: `%${q}%` } : undefined,
        },
        orderBy: {
            [orderBy]: sort,
        },
        columns: {
            id: true,
            createdAt: true,
            updatedAt: true,
            platform: true,
            category: true,
            name: true,
            niceName: true,
            image: true,
            price: true,
            likes: true,
            nsfw: true,
            outdated: true,
        },
        with: {
            shop: {
                columns: {
                    id: true,
                    platform: true,
                    name: true,
                    image: true,
                    verified: true,
                },
            },
        },
    })

    defineCacheControl({ cdnAge: 60 * 5, clientAge: 60 })

    return {
        data,
        pagination: {
            page,
            limit,
            total: data[0]?.count || 0,
            totalPages: Math.ceil((data[0]?.count || 0) / limit),
            hasNext: offset + limit < (data[0]?.count || 0),
            hasPrev: offset > 0,
        },
    }
})
