import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { locales } from '~~/database/schema'

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
    lang: z.enum(locales.enumValues).optional().default('ja'),
})

interface I18nChangelog extends Changelog {
    fallbacked: boolean
}

export default promiseEventHandler<PaginationResponse<I18nChangelog[]>>(async () => {
    const { q, sort, userId, page, limit, lang } = await validateQuery(query)

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
            i18n: {
                columns: {
                    locale: true,
                    title: true,
                    markdown: true,
                    html: true,
                    aiGenerated: true,
                },
            },
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
        data: data.map((changelog) => {
            const i18nData = changelog.i18n.find((i18n) => i18n.locale === lang)

            return {
                slug: changelog.slug,
                createdAt: changelog.createdAt,
                updatedAt: changelog.updatedAt,
                title: i18nData?.title || changelog.title,
                markdown: i18nData?.markdown || changelog.markdown,
                html: i18nData?.html || changelog.html,
                authors: changelog.authors.map((author) => author.user),
                aiGenerated: i18nData?.aiGenerated || false,
                fallbacked: lang !== 'ja' && !i18nData,
            }
        }),
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
