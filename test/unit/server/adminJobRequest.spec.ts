import {
    createApp,
    createError,
    eventHandler,
    getQuery,
    toWebHandler,
    type H3Event,
} from '@nuxt/nitro-server/h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAdminJobRequest } from '../../../server/utils/adminJobRequest'

const requireAdminSession = vi.fn()
const runTask = vi.fn(async () => ({ result: { ok: true } }))
let configuration: Record<string, string>
let siteUrl: string

beforeEach(() => {
    configuration = {}
    siteUrl = 'http://localhost:3000'
    requireAdminSession.mockReset().mockResolvedValue({ user: { id: 'admin' } })
    runTask.mockClear()
    Object.entries({
        createError,
        getQuery,
        requireAdminSession,
        requireAdminJobRequest,
        runTask,
        getRuntimeEnvString: (name: string) => configuration[name],
        useRuntimeConfig: () => ({ public: { siteUrl } }),
        promiseEventHandler: (handler: unknown) => handler,
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
})
afterEach(() => vi.unstubAllGlobals())

const request = async (
    job: string,
    method = 'POST',
    origin: string | null = siteUrl,
    headers: Record<string, string> = {},
) => {
    const handler = (job === 'cleanup'
        ? await import('../../../server/api/admin/job/cleanup')
        : await import('../../../server/api/admin/job/report')
    ).default as unknown as (context: { event: H3Event }) => Promise<unknown>
    const app = createApp().use(eventHandler((event) => handler({ event })))
    return toWebHandler(app)(
        new Request(`http://localhost:3000/api/admin/job/${job}?dryRun=1`, {
            method,
            headers: { ...(origin === null ? {} : { origin }), ...headers },
        }),
    )
}

describe.each(['cleanup', 'report'])('%s HTTP job authorization', (job) => {
    it.each(['GET', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])(
        'rejects authenticated %s without dispatch',
        async (method) => {
            expect((await request(job, method)).status).toBe(405)
            expect(runTask).not.toHaveBeenCalled()
        },
    )
    it.each([
        null,
        '',
        'null',
        'https://evil.test',
        'http://localhost:3000.evil.test',
        'http://localhost:3000/path',
        'http://localhost:3000/',
        'http://user@localhost:3000',
        'http://localhost:3000#fragment',
        'http://localhost:3000 https://evil.test',
        'http://localhost:3000, https://evil.test',
        'file://localhost:3000',
    ])('rejects untrusted or malformed Origin %s without dispatch', async (origin) => {
        expect(
            (
                await request(job, 'POST', origin, {
                    host: 'evil.test',
                    'x-forwarded-host': 'evil.test',
                    'x-forwarded-proto': 'https',
                })
            ).status,
        ).toBe(403)
        expect(runTask).not.toHaveBeenCalled()
    })
    it.each([401, 403])('preserves session rejection %i', async (statusCode) => {
        requireAdminSession.mockRejectedValue(createError({ statusCode }))
        expect((await request(job)).status).toBe(statusCode)
        expect(runTask).not.toHaveBeenCalled()
    })
    it('dispatches an approved local POST once and preserves cleanup dry-run query', async () => {
        expect((await request(job)).status).toBe(200)
        expect(requireAdminSession).toHaveBeenCalledTimes(1)
        expect(runTask.mock.calls).toEqual(
            job === 'cleanup' ? [['job:cleanup', { payload: { dryRun: true } }]] : [['job:report']],
        )
    })
    it('accepts the configured production origin', async () => {
        siteUrl = 'https://avatio.me'
        configuration = { STAGE: 'production', AUTH_TRUSTED_ORIGINS: '["https://avatio.me"]' }
        expect((await request(job)).status).toBe(200)
        expect(runTask).toHaveBeenCalledTimes(1)
    })
    it('trusts only the exact configured Preview origin and fails closed when unconfigured', async () => {
        const origin = 'https://development-avatio.example.workers.dev'
        configuration = {
            STAGE: 'development',
            PREVIEW_NAME: 'development',
            AUTH_TRUSTED_ORIGINS: JSON.stringify([origin]),
        }
        expect((await request(job, 'POST', origin)).status).toBe(200)
        runTask.mockClear()
        for (const disallowed of [siteUrl, 'https://other-avatio.example.workers.dev'])
            expect((await request(job, 'POST', disallowed)).status).toBe(403)
        delete configuration.AUTH_TRUSTED_ORIGINS
        expect((await request(job, 'POST', origin)).status).toBe(403)
        expect(runTask).not.toHaveBeenCalled()
    })
})
