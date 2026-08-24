import { createError, defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3'

import { contentLocales, contentPages, fallbackLocale } from '#avatio/content'

import { resolveContentPage } from '../../content'

export default defineEventHandler((event) => {
    const slug = getRouterParam(event, 'slug') ?? ''
    const localeValue = getQuery(event).locale
    const locale = typeof localeValue === 'string' ? localeValue : fallbackLocale
    if (!/^[a-z0-9][a-z0-9-/]*$/i.test(slug) || !contentLocales.includes(locale)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid content request.' })
    }

    const page = resolveContentPage(contentPages, locale, slug, fallbackLocale)
    if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })

    setHeader(
        event,
        'Cache-Control',
        'public, max-age=300, s-maxage=86400, stale-while-revalidate=3600',
    )
    return page
})
