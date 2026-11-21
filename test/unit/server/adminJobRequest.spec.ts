import {
    createApp,
    createError,
    eventHandler,
    getQuery,
    toWebHandler,
    type H3Event,
} from '@nuxt/nitro-server/h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAdminJobRequest } from '../../../layers/admin/server/utils/session'
import { assertSessionNotBanned } from '../../../server/utils/eventHandler'

const requireUserSession = vi.fn()
const runTask = vi.fn(async () => ({ result: { ok: true } }))
let trustedOrigins: string[]
let siteUrl: string

beforeEach(() => {
    trustedOrigins = ['http://localhost:3000']
    siteUrl = 'http://localhost:3000'
    requireUserSession
        .mockReset()
        .mockResolvedValue({ user: { id: 'admin', role: 'admin', banned: false } })
    runTask.mockClear()
    Object.entries({
        assertSessionNotBanned,
        createError,
        getQuery,
        requireUserSession,
        requireAdminJobRequest,
        runTask,
        getRuntimeStageConfig: () => ({ trustedOrigins }),
        useRuntimeConfig: () => ({ public: { siteUrl } }),
        promiseEventHandler: (handler: unknown) => handler,
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
})
afterEach(() => vi.unstubAllGlobals())

const runGuard = (
    method = 'POST',
    origin: string | null = siteUrl,
    headers: Record<string, string> = {},
) => {
    const app = createApp().use(
        eventHandler(async (event) => {
            await requireAdminJobRequest(event)
            return { ok: true }
        }),
    )
    return toWebHandler(app)(
        new Request('http://localhost:3000/api/admin/job/test', {
            method,
            headers: { ...(origin === null ? {} : { origin }), ...headers },
        }),
    )
}

const requestRoute = async (
    job: 'cleanup' | 'report',
    method = 'POST',
    origin: string | null = siteUrl,
) => {
    const handler = (job === 'cleanup'
        ? await import('../../../layers/admin/server/api/admin/job/cleanup')
        : await import('../../../layers/admin/server/api/admin/job/report')
    ).default as unknown as (context: { event: H3Event }) => Promise<unknown>
    const app = createApp().use(eventHandler((event) => handler({ event })))
    return toWebHandler(app)(
        new Request(`http://localhost:3000/api/admin/job/${job}?dryRun=1`, {
            method,
            headers: origin === null ? {} : { origin },
        }),
    )
}

describe('requireAdminJobRequest', () => {
    it('rejects authenticated non-POST methods', async () => {
        for (const method of ['GET', 'PUT']) {
            expect((await runGuard(method)).status).toBe(405)
        }
    })

    it('rejects missing, empty, malformed, and untrusted Origin headers even with spoofed host headers', async () => {
        for (const origin of [
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
        ]) {
            expect(
                (
                    await runGuard('POST', origin, {
                        host: 'evil.test',
                        'x-forwarded-host': 'evil.test',
                        'x-forwarded-proto': 'https',
                    })
                ).status,
            ).toBe(403)
        }
    })

    it('rejects non-HTTP(S) and non-canonical Origin values even if listed in trustedOrigins', async () => {
        trustedOrigins = [
            'ftp://localhost:3000',
            'file://localhost:3000',
            'http://localhost:3000/path',
        ]
        for (const origin of trustedOrigins) {
            expect((await runGuard('POST', origin)).status).toBe(403)
        }
    })

    it('preserves session rejection status codes', async () => {
        for (const statusCode of [401, 403]) {
            requireUserSession.mockRejectedValueOnce(createError({ statusCode }))
            expect((await runGuard()).status).toBe(statusCode)
        }
    })

    it('accepts configured production origin', async () => {
        siteUrl = 'https://avatio.me'
        trustedOrigins = ['https://avatio.me']
        expect((await runGuard('POST', 'https://avatio.me')).status).toBe(200)
    })

    it('trusts only the development custom domain and fails closed with no approved origin', async () => {
        const origin = 'https://dev.avatio.me'
        trustedOrigins = [origin]
        expect((await runGuard('POST', origin)).status).toBe(200)
        for (const disallowed of [
            siteUrl,
            'https://other.example.workers.dev',
            'https://avatio.me',
        ]) {
            expect((await runGuard('POST', disallowed)).status).toBe(403)
        }
        trustedOrigins = []
        expect((await runGuard('POST', origin)).status).toBe(403)
    })
})

describe.each(['cleanup', 'report'] as const)('%s HTTP job route', (job) => {
    it('dispatches an approved local POST once and preserves cleanup dry-run query', async () => {
        expect((await requestRoute(job)).status).toBe(200)
        expect(requireUserSession).toHaveBeenCalledTimes(1)
        expect(runTask.mock.calls).toEqual(
            job === 'cleanup' ? [['job:cleanup', { payload: { dryRun: true } }]] : [['job:report']],
        )
    })

    it('does not dispatch when authorization fails', async () => {
        expect((await requestRoute(job, 'GET')).status).toBe(405)
        expect((await requestRoute(job, 'POST', 'https://evil.test')).status).toBe(403)
        requireUserSession.mockRejectedValueOnce(createError({ statusCode: 401 }))
        expect((await requestRoute(job)).status).toBe(401)
        expect(runTask).not.toHaveBeenCalled()
    })
})
