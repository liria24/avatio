import database from '@@/database'
import { auditLogs, changelogAuthors } from '@@/database/schema'
import { and, eq, exists, ilike } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    q: z.string().optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().nullable().optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<PaginationResponse<Changelog[]>>(
    async () => {
        const { q, sort, userId, page, limit } = await validateQuery(query)

        const offset = (page - 1) * limit

        const data = await database.query.changelogs.findMany({
            extras: (table) => {
                const conditions = []

                if (q) conditions.push(ilike(table.title, `%${q}%`))

                if (userId)
                    conditions.push(
                        exists(
                            database
                                .select()
                                .from(changelogAuthors)
                                .where(
                                    and(
                                        eq(
                                            changelogAuthors.changelogSlug,
                                            table.slug
                                        ),
                                        eq(changelogAuthors.userId, userId)
                                    )
                                )
                        )
                    )

                return {
                    count: database
                        .$count(auditLogs, and(...conditions))
                        .as('count'),
                }
            },
            limit,
            offset,
            orderBy: (table, { asc, desc }) => {
                const sortFn = sort === 'desc' ? desc : asc
                return sortFn(table.createdAt)
            },
            where: (table, { and, eq, ilike }) => {
                const conditions = []

                if (q) conditions.push(ilike(table.title, `%${q}%`))

                if (userId)
                    conditions.push(
                        exists(
                            database
                                .select()
                                .from(changelogAuthors)
                                .where(
                                    and(
                                        eq(
                                            changelogAuthors.changelogSlug,
                                            table.slug
                                        ),
                                        eq(changelogAuthors.userId, userId)
                                    )
                                )
                        )
                    )

                return and(...conditions)
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

        return {
            data: data.map((changelog) => ({
                ...changelog,
                createdAt: changelog.createdAt.toISOString(),
                updatedAt: changelog.updatedAt.toISOString(),
                authors: changelog.authors.map((author) => ({
                    ...author.user,
                    createdAt: author.user.createdAt.toISOString(),
                    badges: author.user.badges.map((badge) => ({
                        ...badge,
                        createdAt: badge.createdAt.toISOString(),
                    })),
                    shops: author.user.shops.map((userShop) => ({
                        ...userShop,
                        createdAt: userShop.createdAt.toISOString(),
                    })),
                })),
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
        errorMessage: 'Failed to get changelogs.',
    }
)
