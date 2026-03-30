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
    status: z.enum(['open', 'closed', 'all']).optional().default('all'),
})

export default adminSessionEventHandler(async () => {
    const { sort, reporterId, page, limit, status } = await validateQuery(query)

    const offset = (page - 1) * limit

    const data = await db.query.userReports.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        where: {
            reporterId: reporterId ? { eq: reporterId } : undefined,
            isResolved:
                status === 'open' ? { eq: false } : status === 'closed' ? { eq: true } : undefined,
        },
        limit,
        offset,
        orderBy: {
            createdAt: sort,
        },
        columns: {
            id: true,
            createdAt: true,
            spam: true,
            hate: true,
            infringe: true,
            badImage: true,
            other: true,
            comment: true,
            isResolved: true,
        },
        with: {
            reportee: {
                columns: {
                    id: true,
                    username: true,
                    name: true,
                    image: true,
                },
            },
            reporter: {
                columns: {
                    id: true,
                    username: true,
                    name: true,
                    image: true,
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
