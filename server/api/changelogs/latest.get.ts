import { z } from 'zod'
import { locales } from '~~/database/schema'

const query = z.object({
    lang: z.enum(locales.enumValues).optional().default('ja'),
})

export default promiseEventHandler(async () => {
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

    defineCacheControl({ cdnAge: 60 * 60 * 24, clientAge: 60 * 60 })

    const i18nData = data?.i18n.find((i18n) => i18n.locale === lang)

    return {
        slug: data?.slug,
        title: i18nData?.title || data?.title,
        fallbacked: lang !== 'ja' && !i18nData,
    }
})
