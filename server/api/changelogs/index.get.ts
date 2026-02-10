import { sql } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().nullable().optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(CHANGELOGS_API_DEFAULT_LIMIT),
})

export default promiseEventHandler<PaginationResponse<Changelog[]>>(async () => {
    const { q, sort, userId, page, limit } = await validateQuery(query)

    const offset = (page - 1) * limit

    const data = await db.query.changelogs.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        limit,
        offset,
        orderBy: {
            createdAt: sort,
        },
        where: {
            title: q ? { ilike: `%${q}%` } : undefined,
            authors: userId ? { userId: { eq: userId || undefined } } : undefined,
        },
        columns: {
            slug: true,
            createdAt: true,
            updatedAt: true,
            title: true,
            markdown: true,
            html: true,
        },
        with: {
            authors: {
                with: {
                    user: {
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
            },
        },
    })

    defineCacheControl({ cdnAge: 60 * 60 * 24, clientAge: 60 * 60 })

    return {
        data: data.map((changelog) => ({
            ...changelog,
            authors: changelog.authors.map((author) => author.user),
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
})
