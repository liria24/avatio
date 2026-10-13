import { createError } from 'nuxt/server'
import { z } from 'zod'

import { contentConfig } from '#avatio/content-config'

const log = logger('authoredContent')

export default requestEventHandler(async ({ event }) => {
    const { slug } = validateRequestParams(
        event,
        z.object({ slug: z.string().regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/i) }),
    )
    const { locale } = validateRequestQuery(
        event,
        z.object({
            locale: z
                .string()
                .refine((value) => contentConfig.locales.includes(value))
                .default(contentConfig.fallbackLocale),
        }),
    )
    let page
    try {
        page = await (await getContentService()).getPage(slug, locale)
    } catch (error) {
        log.error('Content page lookup failed', {
            slug,
            locale,
            error: String(error),
            cause: error instanceof Error ? String(error.cause) : undefined,
        })
        throw createError({ status: 503, message: 'Content is temporarily unavailable.' })
    }
    if (!page) throw createError({ status: 404, message: 'Page not found.' })
    event.res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    return page
})
