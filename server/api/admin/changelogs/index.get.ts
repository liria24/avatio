import { z } from 'zod'
import { locales } from '~~/database/schema'

const query = z.object({
    q: z.string().optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().nullable().optional(),
    limit: z.coerce.number().min(1).optional(),
    lang: z.enum(locales.enumValues).optional().default('ja'),
    content: z.stringbool().optional().default(false),
})

export default adminSessionEventHandler(async () => {
    const { q, sort, userId, limit, lang, content } = await validateQuery(query)

    const data = await db.query.changelogs.findMany({
        limit,
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
            markdown: content ? true : undefined,
        },
        with: {
            i18n: {
                columns: {
                    locale: true,
                    title: true,
                    markdown: content ? true : undefined,
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
                        },
                    },
                },
            },
        },
    })

    return data.map((changelog) => {
        const i18nData = changelog.i18n.find((i18n) => i18n.locale === lang)

        return {
            slug: changelog.slug,
            createdAt: changelog.createdAt,
            updatedAt: changelog.updatedAt,
            title: i18nData?.title || changelog.title,
            // @ts-expect-error - markdown is optional based on the query, but we want to include it in the response if it was requested
            markdown: i18nData?.markdown || changelog.markdown,
            authors: changelog.authors.map((author) => author.user),
            aiGenerated: i18nData?.aiGenerated || false,
        }
    })
})
