import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createFiles } from 'files-sdk'
import type { FilesApi } from 'files-sdk/api'
import { fs } from 'files-sdk/fs'
import { it, expect, vi } from 'vitest'
import type { ZodType } from 'zod'

vi.mock('files-sdk/nitro', () => ({
    createRouteHandler: (router: FilesApi) => (event: { web: { request: Request } }) =>
        router.handle(event.web.request),
}))

it('allows admin reads while rejecting other users and all writes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'avatio-admin-files-'))
    const files = createFiles({
        adapter: fs({ root: directory, urlBaseUrl: 'http://localhost:3000/api/_local/files' }),
    })
    await files.upload('setup/test/image.png', new Blob(['image bytes'], { type: 'image/png' }))

    let role: 'admin' | 'user' | null = 'admin'
    let banned = false
    let request: Request
    const fail = (statusCode: number) =>
        Object.assign(new Error(String(statusCode)), { statusCode })

    Object.entries({
        promiseEventHandler: (handler: unknown) => handler,
        requireUserSession: async (_event: unknown, options: unknown) => {
            expect(options).toEqual({ user: { role: 'admin' } })
            if (!role) throw fail(401)
            if (role !== 'admin') throw fail(403)
            return { user: { role, banned } }
        },
        assertSessionNotBanned: (session: { user: { banned: boolean } }) => {
            if (session.user.banned) throw fail(403)
        },
        useServerFiles: () => files,
        getMethod: () => request.method,
        getRequestURL: () => new URL(request.url),
        getRequestHeaders: () => Object.fromEntries(request.headers),
        validateBody: async (schema: ZodType) => schema.parse(await request.clone().json()),
        validateQuery: async (schema: ZodType) =>
            schema.parse(Object.fromEntries(new URL(request.url).searchParams)),
        createError: ({ statusCode }: { statusCode: number }) => fail(statusCode),
    }).forEach(([name, value]) => vi.stubGlobal(name, value))

    try {
        const route = (await import('../../../server/api/admin/files'))
            .default as unknown as (context: {
            event: { web: { request: Request } }
        }) => Promise<Response>
        const call = (method: string, body?: object, query = '') => {
            request = new Request(`http://localhost:3000/api/admin/files${query}`, {
                method,
                ...(body && {
                    body: JSON.stringify(body),
                    headers: { 'content-type': 'application/json' },
                }),
            })
            return route({ event: { web: { request } } })
        }

        const listed = await call('POST', { op: 'list', prefix: 'setup/test/', limit: 100 })
        expect(listed.status).toBe(200)
        expect(listed.headers.get('cache-control')).toBe('private, no-store')
        expect((await listed.json()).items[0].key).toBe('setup/test/image.png')

        const searched = await call('POST', {
            op: 'search',
            pattern: 'image',
            match: 'substring',
            maxResults: 50,
        })
        expect((await searched.json()).matches[0].key).toBe('setup/test/image.png')

        const downloaded = await call('GET', undefined, '?op=download&key=setup%2Ftest%2Fimage.png')
        expect(downloaded.headers.get('content-disposition')).toBe('attachment')
        expect(await downloaded.text()).toBe('image bytes')

        await expect(call('POST', { op: 'delete', key: 'setup/test/image.png' })).rejects.toThrow()
        await expect(call('PUT')).rejects.toMatchObject({ statusCode: 405 })
        expect(await files.exists('setup/test/image.png')).toBe(true)

        role = 'user'
        await expect(call('POST', { op: 'list' })).rejects.toMatchObject({ statusCode: 403 })
        role = null
        await expect(call('POST', { op: 'list' })).rejects.toMatchObject({ statusCode: 401 })
        role = 'admin'
        banned = true
        await expect(call('POST', { op: 'list' })).rejects.toMatchObject({ statusCode: 403 })
    } finally {
        vi.unstubAllGlobals()
        vi.resetModules()
        await rm(directory, { recursive: true, force: true })
    }
})
