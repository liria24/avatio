import { z } from 'zod'

/**
 * Development-only read path for files-sdk's local filesystem. Deployed Workers
 * use the stage-specific R2 custom domain instead of exposing this route.
 */
export default promiseEventHandler(async ({ event }) => {
    if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

    const { path: rawPath } = await validateParams(z.object({ path: z.string().min(1) }))

    let key: string
    try {
        key = decodeURIComponent(rawPath)
    } catch {
        throw createError({ statusCode: 400, statusMessage: 'Invalid object path' })
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
        throw createError({ statusCode: 400, statusMessage: 'Invalid object path' })

    let file
    try {
        const storage = useServerFiles()
        file = await storage.download(key)
    } catch {
        throw createError({ statusCode: 404, statusMessage: 'Object not found' })
    }

    setResponseHeader(event, 'Content-Type', file.type || 'application/octet-stream')
    setResponseHeader(event, 'Cache-Control', 'no-store')
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
    setResponseHeader(event, 'Content-Length', file.size)
    if (file.etag) setResponseHeader(event, 'ETag', file.etag)
    return file.stream()
})
