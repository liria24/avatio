import { z } from 'zod'
import { locales } from '~~/database/schema'

const query = z.object({
    lang: z.enum(locales).optional().default('ja'),
})

export default promiseEventHandler(async ({ event, db }) => {
    const { lang } = await validateQuery(query)

    const data = await db.query.changelogs.findFirst({
        orderBy: {
            createdAt: 'desc',
        },
        columns: {
            slug: true,
            title: true,
        },
        with: {
            i18n: {
                columns: {
                    locale: true,
                    title: true,
                },
            },
        },
    })

    if (!data) throw serverError.notFound()

    const i18nData = data?.i18n.find((i18n) => i18n.locale === lang)

    const result = {
        slug: data?.slug,
        title: i18nData?.title || data?.title,
        fallbacked: lang !== 'ja' && !i18nData,
    }

    applyPublicEdgeCache(event, [EDGE_CACHE_TAGS.changelogs])
    return result
})
