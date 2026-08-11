import type { H3Event } from 'h3'
import type { RenderResponse } from 'nitropack/types'

const withoutCacheHeaders = (headers: Record<string, string>, preserveVary = false) =>
    Object.fromEntries(
        Object.entries(headers).filter(([key]) => {
            const normalizedKey = key.toLowerCase()
            return (
                normalizedKey !== 'cache-control' &&
                normalizedKey !== 'cloudflare-cdn-cache-control' &&
                normalizedKey !== 'cache-tag' &&
                (preserveVary || normalizedKey !== 'vary')
            )
        }),
    )

const getNoStoreHeaders = (headers: Record<string, string>) => ({
    ...withoutCacheHeaders(headers, true),
    'Cache-Control': NO_STORE_CACHE_CONTROL,
})

const getPublicCacheHeaders = (
    headers: Record<string, string>,
    cacheHeaders: Record<string, string>,
) => ({
    ...withoutCacheHeaders(headers),
    ...cacheHeaders,
})

const applyPublicDocumentCache = (response: Partial<RenderResponse>, event: H3Event) => {
    const headers = response.headers ?? {}
    const cacheHeaders = getDocumentCacheHeaders(
        getRequestURL(event).pathname,
        response.statusCode ?? 200,
        event.headers.get('cookie'),
    )

    if (cacheHeaders['Cache-Control'] === NO_STORE_CACHE_CONTROL) {
        response.headers = getNoStoreHeaders(headers)
        return
    }

    response.headers = getPublicCacheHeaders(headers, cacheHeaders)
}

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('render:response', (response, context) => {
        applyPublicDocumentCache(response, context.event)
    })

    nitroApp.hooks.hook('beforeResponse', (event) => {
        if (!getResponseHeader(event, 'Cloudflare-CDN-Cache-Control')) applyNoStoreCache(event)
    })
})
