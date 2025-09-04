import database from '@@/database'
import { setupReports } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

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

type ApiResponse = PaginationResponse<
    (Omit<SetupReport, 'setup'> & {
        setup: Omit<Setup, 'items' | 'tags' | 'coauthors'>
    })[]
>

export default defineApi<ApiResponse>(
    async () => {
        const { sort, reporterId, page, limit, isResolved } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await database.query.setupReports.findMany({
            extras: (table) => {
                const conditions = []

                if (reporterId)
                    conditions.push(eq(table.reporterId, reporterId))
                if (isResolved !== undefined && isResolved.length === 1)
                    conditions.push(eq(table.isResolved, isResolved[0]))

                return {
                    count: database
                        .$count(setupReports, and(...conditions))
                        .as('count'),
                }
            },
            where: (table, { and, eq }) => {
                const conditions = []

                if (reporterId)
                    conditions.push(eq(table.reporterId, reporterId))
                if (isResolved !== undefined && isResolved.length === 1)
                    conditions.push(eq(table.isResolved, isResolved[0]))

                return and(...conditions)
            },
            limit,
            offset,
            orderBy: (table, { asc, desc }) => {
                const sortFn = sort === 'desc' ? desc : asc
                return sortFn(table.createdAt)
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
                setup: {
                    columns: {
                        id: true,
                        createdAt: true,
                        updatedAt: true,
                        name: true,
                        description: true,
                        hidAt: true,
                        hidReason: true,
                    },
                    with: {
                        user: {
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
                        images: {
                            columns: {
                                url: true,
                                width: true,
                                height: true,
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
            data: data.map((report) => ({
                ...report,
                createdAt: report.createdAt.toISOString(),
                setup: {
                    ...report.setup,
                    createdAt: report.setup.createdAt.toISOString(),
                    updatedAt: report.setup.updatedAt.toISOString(),
                    hidAt: report.setup.hidAt?.toISOString() || null,
                    user: {
                        ...report.setup.user,
                        createdAt: report.setup.user.createdAt.toISOString(),
                        badges: report.setup.user.badges.map((badge) => ({
                            ...badge,
                            createdAt: badge.createdAt.toISOString(),
                        })),
                        shops: report.setup.user.shops.map((userShop) => ({
                            ...userShop,
                            createdAt: userShop.createdAt.toISOString(),
                        })),
                    },
                },
                reporter: {
                    ...report.reporter,
                    createdAt: report.reporter.createdAt.toISOString(),
                    badges: report.reporter.badges.map((badge) => ({
                        ...badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                    shops: report.reporter.shops.map((userShop) => ({
                        ...userShop,
                        createdAt: userShop.createdAt.toISOString(),
                    })),
                },
            })),
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
        errorMessage: 'Failed to get item reports.',
        requireAdmin: true,
    }
)
