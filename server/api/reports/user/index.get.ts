import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { userReports } from '~~/database/schema'

const query = z.object({
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    reporterId: z.string().nullable().optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(100),
    isResolved: z
        .union([
            z.union([z.boolean(), z.stringbool()]).array(),
            z.boolean(),
            z.stringbool(),
        ])
        .transform((val) => (Array.isArray(val) ? val : [val]))
        .optional(),
})

export default defineApi<PaginationResponse<UserReport[]>>(
    async () => {
        const { sort, reporterId, page, limit, isResolved } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await db.query.userReports.findMany({
            extras: {
                count: db
                    .$count(
                        userReports,
                        and(
                            ...[
                                reporterId
                                    ? eq(userReports.reporterId, reporterId)
                                    : undefined,
                                isResolved !== undefined &&
                                isResolved.length === 1
                                    ? eq(userReports.isResolved, isResolved[0])
                                    : undefined,
                            ]
                        )
                    )
                    .as('count'),
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
                reporter: {
                    columns: {
                        id: true,
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
    },
    {
        errorMessage: 'Failed to get user reports.',
        requireAdmin: true,
    }
)
