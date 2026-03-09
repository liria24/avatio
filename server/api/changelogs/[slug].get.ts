import { z } from 'zod'
import { locales } from '~~/database/schema'

const params = z.object({
    slug: z.string(),
})

const query = z.object({
    lang: z.enum(locales.enumValues).optional().default('ja'),
})

interface I18nChangelog extends Changelog {
    fallbacked: boolean
}

export default promiseEventHandler<I18nChangelog>(async () => {
    const { slug } = await validateParams(params)
    const { lang } = await validateQuery(query)

    const data = await db.query.changelogs.findFirst({
        where: {
            slug: { eq: slug },
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
                        },
                    },
                },
            },
        },
    })

    if (!data)
        throw createError({
            status: 404,
            statusText: 'Changelog not found',
        })

    const i18nData = data.i18n.find((i18n) => i18n.locale === lang)

    defineCacheControl({ cdnAge: 60 * 60 * 24, clientAge: 60 * 60 })

    return {
        slug: data.slug,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        title: i18nData?.title || data.title,
        markdown: i18nData?.markdown || data.markdown,
        authors: data.authors.map((author) => author.user),
        aiGenerated: i18nData?.aiGenerated || false,
        fallbacked: lang !== 'ja' && !i18nData,
    }
})
