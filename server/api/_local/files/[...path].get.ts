import { createError } from 'nuxt/server'
import { z } from 'zod'

/**
 * Development-only read path for files-sdk's local filesystem. Deployed Workers
 * use the stage-specific R2 custom domain instead of exposing this route.
 */
export default requestEventHandler(async ({ event }) => {
    if (!import.meta.dev) throw createError({ status: 404, statusText: 'Not Found' })

    const { path: rawPath } = validateRequestParams(event, z.object({ path: z.string().min(1) }))

    let key: string
    try {
        key = decodeURIComponent(rawPath)
    } catch {
        throw createError({ status: 400, statusText: 'Invalid object path' })
    }

    if (
        !key ||
        key.startsWith('/') ||
        key.includes('..') ||
        key.includes('\\') ||
        key.includes(':') ||
        Array.from(key).some((character) => character.charCodeAt(0) < 32) ||
        key.endsWith('.meta.json')
    )
        throw createError({ status: 400, statusText: 'Invalid object path' })

    let file
    try {
        const storage = useServerFiles()
        file = await storage.download(key)
    } catch {
        throw createError({ status: 404, statusText: 'Object not found' })
    }

    event.res.headers.set('Content-Type', file.type || 'application/octet-stream')
    event.res.headers.set('Cache-Control', 'no-store')
    event.res.headers.set('X-Content-Type-Options', 'nosniff')
    event.res.headers.set('Content-Length', String(file.size))
    if (file.etag) event.res.headers.set('ETag', file.etag)
    return file.stream()
})
