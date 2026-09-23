import { createFilesRouter, type FilesOperation } from 'files-sdk/api'
import { createRouteHandler } from 'files-sdk/nitro'
import { z } from 'zod'

const operations = ['list', 'search', 'download'] as const satisfies readonly FilesOperation[]

const bodySchema = z.discriminatedUnion('op', [
    z.object({
        op: z.literal('list'),
        prefix: z.string().optional(),
        cursor: z.string().optional(),
        delimiter: z.literal('/').optional(),
        limit: z.number().int().min(1).max(100).optional(),
    }),
    z.object({
        op: z.literal('search'),
        pattern: z.string().min(1).max(256),
        match: z.enum(['substring', 'glob', 'regex', 'exact']).optional(),
        caseInsensitive: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        maxResults: z.number().int().min(1).max(50).optional(),
    }),
])

const querySchema = z.object({
    op: z.literal('download'),
    key: z.string().min(1),
})

const router = createFilesRouter({
    files: () => useServerFiles().readonly(),
    operations,
    maxListLimit: 100,
    maxSearchResults: 50,
    secret: crypto.randomUUID(),
})

const downloadHandler = createRouteHandler(router)

export default promiseEventHandler(async ({ event }) => {
    const session = await requireUserSession(event, { user: { role: 'admin' } })
    assertSessionNotBanned(session)

    let response: Response
    if (getMethod(event) === 'GET') {
        await validateQuery(querySchema)
        response = await downloadHandler(event)
    } else if (getMethod(event) === 'POST') {
        const body = await validateBody(bodySchema, { sanitize: true })
        response = await router.handle(
            new Request(getRequestURL(event), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: event.web?.request?.signal,
            }),
        )
    } else {
        throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
    }

    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    return response
})
