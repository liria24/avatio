import { sql } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    reporterId: z.string().nullable().optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(ADMIN_REPORTS_API_DEFAULT_LIMIT),
    isResolved: z
        .union([z.union([z.boolean(), z.stringbool()]).array(), z.boolean(), z.stringbool()])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .optional(),
})

export default adminSessionEventHandler<PaginationResponse<ItemReport[]>>(async () => {
    const { sort, reporterId, page, limit, isResolved } = await validateQuery(query)

    const offset = (page - 1) * limit

    const data = await db.query.itemReports.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        where: {
            reporterId: reporterId ? { eq: reporterId } : undefined,
            isResolved:
                isResolved !== undefined && isResolved.length === 1
                    ? { eq: isResolved[0] }
                    : undefined,
        },
        limit,
        offset,
        orderBy: {
            createdAt: sort,
        },
        columns: {
            id: true,
            createdAt: true,
            nameError: true,
            irrelevant: true,
            other: true,
            comment: true,
            isResolved: true,
        },
        with: {
            item: {
                columns: {
                    id: true,
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
            },
            reporter: {
                columns: {
                    id: true,
                    username: true,
                    createdAt: true,
                    name: true,
                    image: true,
                    bio: true,
                    links: true,
                },
                with: {
                    badges: {
                        columns: {
                            badge: true,
                            createdAt: true,
                        },
                    },
                    shops: {
                        columns: {
                            id: true,
                            createdAt: true,
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
                    },
                },
            },
        },
    })

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
