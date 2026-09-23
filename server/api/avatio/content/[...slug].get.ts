import { z } from 'zod'

import { contentConfig } from '#avatio/content-config'

const log = logger('authoredContent')

export default promiseEventHandler(async ({ event }) => {
    const { slug } = await validateParams(
        z.object({ slug: z.string().regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/i) }),
    )
    const { locale } = await validateQuery(
        z.object({
            locale: z
                .string()
                .refine((value) => contentConfig.locales.includes(value))
                .default(contentConfig.fallbackLocale),
        }),
    )
    let page
    try {
        page = await (await getContentService(event)).getPage(slug, locale)
    } catch (error) {
        log.error('Content page lookup failed', {
            slug,
            locale,
            error: String(error),
            cause: error instanceof Error ? String(error.cause) : undefined,
        })
        throw createError({ statusCode: 503, message: 'Content is temporarily unavailable.' })
    }
    if (!page) throw createError({ statusCode: 404, message: 'Page not found.' })
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300')
    return page
})
