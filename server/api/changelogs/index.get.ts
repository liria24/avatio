import { createMarkdownParser } from 'comark'
import breaks from 'comark/plugins/breaks'
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
    lang: z.enum(locales).optional().default('ja'),
})

const parse = createMarkdownParser({ plugins: [breaks()] })

export default requestEventHandler(async ({ event, db }) => {
    const { q, sort, userId, page, limit, lang } = validateRequestQuery(event, query)

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
            title: q ? { like: `%${q}%` } : undefined,
            authors: userId ? { userId: { eq: userId || undefined } } : undefined,
        },
        columns: {
            slug: true,
            createdAt: true,
            updatedAt: true,
            title: true,
            markdown: true,
        },
        with: {
            i18n: {
                columns: {
                    locale: true,
                    title: true,
                    markdown: true,
                    aiGenerated: true,
                },
            },
            authors: {
                with: {
                    user: {
                        columns: {
                            id: true,
                            username: true,
                            name: true,
                            image: true,
                        },
                        with: {
                            badges: {
                                columns: {
                                    badge: true,
                                    createdAt: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    })

    const result = {
        data: await Promise.all(
            data.map(async (changelog) => {
                const i18nData = changelog.i18n.find((i18n) => i18n.locale === lang)
                const tree = await parse(i18nData?.markdown || changelog.markdown)

                return {
                    slug: changelog.slug,
                    createdAt: changelog.createdAt,
                    updatedAt: changelog.updatedAt,
                    title: i18nData?.title || changelog.title,
                    authors: changelog.authors.map((author) => author.user),
                    aiGenerated: i18nData?.aiGenerated || false,
                    fallbacked: lang !== 'ja' && !i18nData,
                    tree,
                }
            }),
        ),
        pagination: createPagination(data[0]?.count || 0, page, limit, offset),
    }

    applyPublicRequestCache(event, [EDGE_CACHE_TAGS.changelogs])
    return result
})
