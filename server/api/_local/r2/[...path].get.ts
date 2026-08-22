/**
 * Development-only read path for the local R2 simulator. Deployed Workers
 * use the stage-specific R2 custom domain instead of exposing this route.
 */
export default promiseEventHandler(async ({ event }) => {
    if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

    const rawPath = event.context.params?.path
    if (!rawPath || rawPath.includes('..'))
        throw createError({ statusCode: 400, statusMessage: 'Invalid object path' })

    let key: string
    try {
        key = decodeURIComponent(rawPath)
    } catch {
        throw createError({ statusCode: 400, statusMessage: 'Invalid object path' })
    }

    if (!key || key.startsWith('/') || key.includes('..'))
        throw createError({ statusCode: 400, statusMessage: 'Invalid object path' })

    let file
    try {
        file = await storage.download(key)
    } catch {
        throw createError({ statusCode: 404, statusMessage: 'Object not found' })
    }

    setResponseHeader(event, 'Content-Type', file.type || 'application/octet-stream')
    setResponseHeader(event, 'Content-Length', file.size)
    if (file.etag) setResponseHeader(event, 'ETag', file.etag)
    return file.stream()
})
