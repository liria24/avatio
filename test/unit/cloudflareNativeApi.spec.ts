import { createCloudflareConfig } from '../../config/cloudflare'
import {
    developmentSchemaSql,
    developmentLedgerSql,
} from '../../scripts/cloudflareDevelopmentLedger'
import { createCloudflareNativeApi } from '../../scripts/cloudflareNativeApi'
import { nativePhase } from '../../scripts/cloudflareNativeDiagnostics'
import { inspectCloudflarePreviewMetadata } from '../../scripts/cloudflarePreviewMetadata'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
const address = (value: Parameters<typeof fetch>[0]) =>
    value instanceof Request ? value.url : value instanceof URL ? value.href : value
const response = (result: unknown) => Response.json({ success: true, result })
const setup = (
    options: {
        conflict?: Record<string, unknown>
        replaceAfter?: boolean
        wrongEndpoint?: boolean
        wrongExact?: boolean
    } = {},
) => {
    let parents = 0
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
        expect(init?.method).toBe('GET')
        const target = address(url)
        const path = new URL(target).pathname
        if (!path.includes('/deployments/')) {
            parents++
            return response({
                id: options.replaceAfter && parents > 1 ? 'replacement' : 'reviewed',
                name: 'development',
                slug: 'development',
            })
        }
        const result = response({
            id: options.wrongExact && path.endsWith('/original') ? 'other' : 'original',
            env: {
                NUXT_BETTER_AUTH_SECRET: { type: 'secret_text', text: 'synthetic-do-not-log' },
                BETTER_AUTH_SECRET: { type: 'plain_text', text: 'synthetic-retired-secret' },
                UNREVIEWED_PRIVATE_NAME: {
                    type: 'synthetic-secret-type',
                    text: 'synthetic-do-not-log',
                },
            },
            annotations: {},
            ...options.conflict,
        })
        if (options.wrongEndpoint)
            Object.defineProperty(result, 'url', {
                value: target.replace('/previews/development/', '/previews/other/'),
            })
        return result
    })
    return { api: createCloudflareNativeApi(inventory, 'synthetic-token', fetcher), fetcher }
}

describe('existing-development read-only API', () => {
    it('has no publisher, deletion, Base configuration or generic request methods', () => {
        const { api } = setup()
        expect(Object.keys(api).sort()).toEqual(['deployment', 'inspect', 'preview', 'query'])
    })
    it.each(['exact', 'latest'])(
        'associates %s deployment with fresh parent and exact-ID reads',
        async (kind) => {
            const { api, fetcher } = setup()
            const result = await api.deployment(
                kind === 'latest' ? 'latest' : 'original',
                'reviewed',
            )
            expect(result).toMatchObject({ id: 'original', previewId: 'reviewed' })
            const paths = fetcher.mock.calls.map(([url]) => new URL(address(url)).pathname)
            expect(paths[0]).toBe(paths.at(-1))
            expect(paths.some((path) => path.endsWith('/deployments/original'))).toBe(true)
            expect(
                paths.every(
                    (path) =>
                        path.endsWith('/previews/development') ||
                        path.includes('/previews/development/deployments/'),
                ),
            ).toBe(true)
        },
    )
    it('returns secret names/types only, without retired values, unknown names/types or token echoes', async () => {
        const { api } = setup()
        const result = await api.deployment('original', 'reviewed')
        expect(result?.requiredSecrets).toContainEqual({
            name: 'NUXT_BETTER_AUTH_SECRET',
            type: 'secret_text',
            secretTypePresent: true,
        })
        const encoded = JSON.stringify(result)
        expect(encoded).not.toMatch(
            /synthetic-do-not-log|synthetic-retired-secret|UNREVIEWED_PRIVATE_NAME|synthetic-secret-type|synthetic-token/,
        )
        expect(result?.unexpectedBindingCount).toBe(2)
    })
    it.each([
        { conflict: { preview_id: 'other' } },
        { conflict: { preview_name: 'production' } },
        { conflict: { id: 'latest' } },
        { replaceAfter: true },
        { wrongEndpoint: true },
        { wrongExact: true },
    ])('rejects wrong parent, changing identity and wrong response scope (%j)', async (options) => {
        const { api } = setup(options)
        await expect(api.deployment('latest', 'reviewed')).rejects.toThrow()
    })
    it('refuses a replaced Preview before deployment access', async () => {
        const { api, fetcher } = setup()
        await expect(api.deployment('original', 'different')).rejects.toThrow(
            /preview-parent-mismatch/,
        )
        expect(fetcher).toHaveBeenCalledTimes(1)
    })
    it.each(['production/../../../', 'pr-354/../development', ''])(
        'rejects path-like deployment identities before GET (%s)',
        async (version) => {
            const { api, fetcher } = setup()
            await expect(api.deployment(version, 'reviewed')).rejects.toThrow()
            expect(fetcher).not.toHaveBeenCalled()
        },
    )
    it.each([developmentSchemaSql, developmentLedgerSql])(
        'permits only the fixed reviewed database SELECT (%s)',
        async (sql) => {
            const fetcher = vi.fn<typeof fetch>(async (url, init) => {
                expect(address(url)).toBe(
                    `https://api.cloudflare.com/client/v4/accounts/${inventory.accountId}/d1/database/${inventory.development.database.id}/query`,
                )
                expect(init?.method).toBe('POST')
                if (typeof init?.body !== 'string') throw new Error('Expected JSON request body')
                expect(JSON.parse(init.body)).toEqual({ sql, params: [] })
                return response([{ success: true, results: [], meta: { rows_written: 0 } }])
            })
            await expect(
                createCloudflareNativeApi(inventory, 'synthetic-token', fetcher).query(sql),
            ).resolves.toEqual([])
        },
    )
    it.each([
        'DELETE FROM users',
        'SELECT * FROM users',
        `${developmentSchemaSql}; DELETE FROM users`,
    ])('rejects arbitrary SQL without a request (%s)', async (sql) => {
        const fetcher = vi.fn<typeof fetch>()
        await expect(
            createCloudflareNativeApi(inventory, 'synthetic-token', fetcher).query(sql),
        ).rejects.toThrow()
        expect(fetcher).not.toHaveBeenCalled()
    })
    it.each([undefined, 1])('requires explicit zero written rows (%s)', async (rows) => {
        const api = createCloudflareNativeApi(inventory, 'synthetic-token', async () =>
            response([{ success: true, results: [], meta: { rows_written: rows } }]),
        )
        await expect(api.query(developmentSchemaSql)).rejects.toThrow()
    })
    it('reports bounded HTTP status without reading or retaining a provider error body', async () => {
        const report = vi.fn()
        const body = 'synthetic-token synthetic-signing-secret'
        const raw = new Response(body, { status: 403 })
        const read = vi.spyOn(raw, 'json')
        const api = createCloudflareNativeApi(inventory, 'synthetic-token', async () => raw)
        await nativePhase('inspection-resources', report, api.preview).catch((error: unknown) => {
            expect(String(error)).not.toContain(body)
        })
        expect(read).not.toHaveBeenCalled()
        expect(report.mock.lastCall?.[0]).toEqual({
            phase: 'inspection-resources',
            outcome: 'failed',
            code: 'api-http-failed',
            httpStatus: 403,
        })
        expect(JSON.stringify(report.mock.calls)).not.toContain('synthetic-token')
    })
    it('does not treat a forbidden response as an absent Preview', async () => {
        const api = createCloudflareNativeApi(
            inventory,
            'synthetic-token',
            async () => new Response('', { status: 403 }),
        )
        await expect(api.preview()).rejects.toThrow(/api-http-failed/)
    })
})

describe('production binding metadata projection', () => {
    const expected = createCloudflareConfig({ mode: 'production', isPreview: false }, inventory)
        .worker.env
    const bindings = {
        ITEM_REVALIDATION_QUEUE: expected.ITEM_REVALIDATION_QUEUE!,
        EMAIL: expected.EMAIL!,
    }
    it('compares queue identity and email restrictions without returning their values', () => {
        const result = inspectCloudflarePreviewMetadata(
            {
                ITEM_REVALIDATION_QUEUE: {
                    type: 'queue',
                    queue_name:
                        bindings.ITEM_REVALIDATION_QUEUE.type === 'queue'
                            ? bindings.ITEM_REVALIDATION_QUEUE.name
                            : '',
                },
                EMAIL: {
                    type: 'send_email',
                    allowed_sender_addresses: [inventory.production.emailFrom],
                },
            },
            bindings,
        )
        expect(result.bindingsVerified).toBe(true)
        expect(JSON.stringify(result)).not.toContain(inventory.production.emailFrom!)
    })
    it('rejects a different queue and expanded email sender scope', () => {
        const result = inspectCloudflarePreviewMetadata(
            {
                ITEM_REVALIDATION_QUEUE: { type: 'queue', queue_name: 'unexpected-queue' },
                EMAIL: {
                    type: 'send_email',
                    allowed_sender_addresses: ['unexpected@example.test'],
                },
            },
            bindings,
        )
        expect(result.bindingsVerified).toBe(false)
        expect(result.bindings.every(({ matches }) => !matches)).toBe(true)
        expect(JSON.stringify(result)).not.toMatch(/unexpected-queue|unexpected@example/)
    })
})
