import { createCloudflareConfig } from '../../config/cloudflare'
import {
    createCloudflareNativeApi,
    verifyCloudflarePreviewBindings,
} from '../../scripts/cloudflareNativeApi'
import { nativePhase } from '../../scripts/cloudflareNativeDiagnostics'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'
const inventory = createCloudflareResourceFixture()
const address = (value: Parameters<typeof fetch>[0]) =>
    value instanceof Request ? value.url : String(value)
const response = (result: unknown, status = 200) =>
    new Response(JSON.stringify({ success: status === 200, result }), {
        status,
        headers: { 'content-type': 'application/json' },
    })

describe('PR-only Preview deletion', () => {
    it.each(['production', 'development', 'pr-0', 'pr-354/../../avatio'])(
        'never deletes %s',
        async (mode) => {
            const fetcher = vi.fn<typeof fetch>()
            await expect(
                createCloudflareNativeApi(
                    inventory.accountId,
                    'synthetic-token',
                    fetcher,
                ).deletePreview(mode, 'p354'),
            ).rejects.toThrow()
            expect(fetcher).not.toHaveBeenCalled()
        },
    )
    it('fails a zero-success deletion when the Preview still exists', async () => {
        const api = createCloudflareNativeApi(
            inventory.accountId,
            'synthetic-token',
            async (_url, init) =>
                response(
                    init?.method === 'DELETE'
                        ? null
                        : { id: 'p354', name: 'pr-354', slug: 'pr-354' },
                ),
        )
        await expect(api.deletePreview('pr-354', 'p354')).rejects.toThrow(/unverified/)
    })
    it('never deletes a replacement created between inspection and deletion', async () => {
        const fetcher = vi.fn<typeof fetch>(async () =>
            response({ id: 'new354', name: 'pr-354', slug: 'pr-354' }),
        )
        await expect(
            createCloudflareNativeApi(
                inventory.accountId,
                'synthetic-token',
                fetcher,
            ).deletePreview('pr-354', 'old354'),
        ).rejects.toThrow(/replaced/)
        expect(fetcher).toHaveBeenCalledTimes(1)
    })
})
describe('specific deployed Preview binding verification', () => {
    const config = createCloudflareConfig({ mode: 'pr-354', isPreview: true }, inventory)
    it('rejects an extra inherited production secret before HTTP health can mask it', () => {
        expect(() =>
            verifyCloudflarePreviewBindings(
                {
                    id: 'v354',
                    preview_name: 'pr-354',
                    env: { PRODUCTION_SECRET: { type: 'secret_text' } },
                },
                config.worker.env,
                { mode: 'pr-354', deploymentId: 'v354' },
            ),
        ).toThrow()
    })
    it('requires D1 identity even when a text-only version answers HTTP', () => {
        const expectedBindings = { APP_DB: config.worker.env.APP_DB! }
        expect(() =>
            verifyCloudflarePreviewBindings(
                {
                    id: 'v354',
                    preview_name: 'pr-354',
                    env: { APP_DB: { type: 'd1', database_id: inventory.production.database.id } },
                },
                expectedBindings,
                { mode: 'pr-354', deploymentId: 'v354' },
            ),
        ).toThrow(/D1 identity/)
    })
    it('cannot verify a stable alias as a different published version', () => {
        expect(() =>
            verifyCloudflarePreviewBindings(
                { id: 'old354', preview_name: 'pr-354', env: {} },
                {},
                { mode: 'pr-354', deploymentId: 'v354' },
            ),
        ).toThrow(/version identity/)
    })
})

describe('Preview-scoped deployment association with the observed beta response', () => {
    const setup = (
        options: {
            conflict?: Record<string, unknown>
            replaceAfter?: boolean
            replaceBefore?: boolean
            wrongEndpoint?: boolean
            inconsistentExact?: boolean
        } = {},
    ) => {
        let parents = 0
        const calls: { url: string; method: string }[] = []
        const fetcher = vi.fn<typeof fetch>(async (url, init) => {
            const target = address(url)
            calls.push({ url: target, method: init?.method ?? 'GET' })
            const path = new URL(target).pathname
            if (!path.includes('/deployments/')) {
                parents++
                return response({
                    id:
                        options.replaceBefore || (options.replaceAfter && parents > 1)
                            ? 'replacement'
                            : 'reviewed',
                    name: 'development',
                    slug: 'development',
                })
            }
            const id =
                init?.method === 'PATCH'
                    ? 'patched'
                    : path.endsWith('/latest')
                      ? 'original'
                      : path.split('/').at(-1)
            const result = response({
                id: options.inconsistentExact && path.endsWith('/original') ? 'unexpected' : id,
                urls: [`https://${id}-development.previews.example.test`],
                env: { BETTER_AUTH_SECRET: { type: 'secret_text', text: 'synthetic-do-not-log' } },
                annotations: {},
                ...options.conflict,
            })
            if (options.wrongEndpoint)
                Object.defineProperty(result, 'url', {
                    value: target.replace('/previews/development/', '/previews/other/'),
                })
            return result
        })
        return {
            api: createCloudflareNativeApi(inventory.accountId, 'synthetic-token', fetcher),
            calls,
        }
    }
    it.each(['exact', 'latest'])(
        'proves %s association without echoed parent fields using fresh parent and exact-ID reads',
        async (kind) => {
            const { api, calls } = setup()
            const result = await api.previewDeployment(
                'development',
                kind === 'latest' ? 'latest' : 'original',
                false,
                'reviewed',
            )
            expect(result).toMatchObject({
                preview_id: 'reviewed',
                preview_name: 'development',
                parentAssociation: 'verified-preview-endpoint',
            })
            expect(JSON.stringify(result)).not.toContain('synthetic-do-not-log')
            expect(calls[0]!.url).toBe(
                `https://api.cloudflare.com/client/v4/accounts/${inventory.accountId}/workers/workers/avatio/previews/development`,
            )
            expect(calls.at(-1)).toEqual(calls[0])
            expect(calls.every((call) => call.url.startsWith(calls[0]!.url))).toBe(true)
            if (kind !== 'exact')
                expect(calls).toContainEqual({
                    url: `${calls[0]!.url}/deployments/original`,
                    method: 'GET',
                })
        },
    )
    it.each([
        { preview_id: 'other' },
        { preview_id: null },
        { preview_name: 'production' },
        { preview_name: null },
    ])('rejects explicit parent conflicts %j', async (conflict) => {
        const { api } = setup({ conflict })
        await expect(
            api.previewDeployment('development', 'latest', false, 'reviewed'),
        ).rejects.toThrow(/preview-(parent-id|name)-mismatch/)
    })
    it('rejects a replaced Preview around an exact read', async () => {
        const { api } = setup({ replaceAfter: true })
        await expect(
            api.previewDeployment('development', 'latest', false, 'reviewed'),
        ).rejects.toThrow(/preview-parent-changed/)
    })
    it('rejects a returned mutable alias masquerading as an exact deployment ID', async () => {
        const { api } = setup({ conflict: { id: 'latest' } })
        await expect(
            api.previewDeployment('development', 'latest', false, 'reviewed'),
        ).rejects.toThrow(/preview-deployment-id-invalid/)
    })
    it('refuses a parent replaced before the read', async () => {
        const { api, calls } = setup({ replaceBefore: true })
        await expect(
            api.previewDeployment('development', 'original', false, 'reviewed'),
        ).rejects.toThrow(/preview-parent-id-mismatch/)
        expect(calls.every((call) => call.method === 'GET')).toBe(true)
    })
    it('rejects a response from another Preview endpoint', async () => {
        const { api } = setup({ wrongEndpoint: true })
        await expect(
            api.previewDeployment('development', 'latest', false, 'reviewed'),
        ).rejects.toThrow(/api-response-scope-mismatch/)
    })
    it('rejects a latest receipt whose exact read returns another deployment', async () => {
        const { api } = setup({ inconsistentExact: true })
        await expect(
            api.previewDeployment('development', 'latest', false, 'reviewed'),
        ).rejects.toThrow(/preview-exact-id-mismatch/)
    })
})

describe('bounded provider failure evidence', () => {
    it.each([
        [10025, 'preview-not-found'],
        [10222, 'deployment-not-found'],
        [10032, 'deployment-not-patchable'],
        [12345, 'unclassified'],
    ] as const)(
        'reports only numeric code %s and a static classification',
        async (code, classification) => {
            const report = vi.fn()
            const api = createCloudflareNativeApi(
                inventory.accountId,
                'synthetic-token',
                async () =>
                    Response.json(
                        {
                            success: false,
                            errors: [{ code, message: 'synthetic-signing-secret/raw-token' }],
                        },
                        { status: 400 },
                    ),
            )
            await expect(
                nativePhase('preview-base', report, () => api.preview('development')),
            ).rejects.toThrow()
            expect(report).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    httpStatus: 400,
                    evidence: expect.objectContaining({
                        providerError: {
                            codes: [code],
                            classification,
                            jsonParsed: true,
                            bodyWithinLimit: true,
                        },
                    }),
                }),
            )
            expect(JSON.stringify(report.mock.calls)).not.toContain('synthetic-signing-secret')
            expect(JSON.stringify(report.mock.calls)).not.toContain('raw-token')
        },
    )
    it('bounds count and rejects strings, negative and oversized error codes', async () => {
        const report = vi.fn()
        const api = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', async () =>
            Response.json(
                {
                    errors: [
                        'secret',
                        { code: '10025' },
                        { code: -1 },
                        { code: 1e10 },
                        ...Array.from({ length: 30 }, (_, code) => ({ code })),
                    ],
                },
                { status: 400 },
            ),
        )
        await expect(
            nativePhase('preview-base', report, () => api.preview('development')),
        ).rejects.toThrow()
        expect(report.mock.calls.at(-1)?.[0].evidence.providerError.codes).toEqual([0, 1, 2, 3])
    })
    it.each(['malformed', 'oversized'])(
        'retains HTTP status for %s bodies without raw text',
        async (kind) => {
            const report = vi.fn()
            const api = createCloudflareNativeApi(
                inventory.accountId,
                'synthetic-token',
                async () =>
                    new Response(kind === 'oversized' ? 'secret'.repeat(4000) : 'secret', {
                        status: 400,
                    }),
            )
            await expect(
                nativePhase('preview-base', report, () => api.preview('development')),
            ).rejects.toThrow()
            expect(report.mock.calls.at(-1)?.[0]).toMatchObject({
                httpStatus: 400,
                evidence: {
                    providerError: {
                        jsonParsed: false,
                        codes: [],
                        bodyWithinLimit: kind !== 'oversized',
                    },
                },
            })
            expect(JSON.stringify(report.mock.calls)).not.toContain('secretsecret')
        },
    )
})
describe('read-only Base settings', () => {
    it('projects binding names/types without transmitting secret values', async () => {
        const fetcher = vi.fn<typeof fetch>(async () =>
            response({
                previews_base_config: {
                    env: {
                        BETTER_AUTH_SECRET: {
                            type: 'secret_text',
                            text: 'synthetic-signing-do-not-log',
                        },
                        NUXT_BETTER_AUTH_SECRET: {
                            type: 'secret_text',
                            text: 'synthetic-signing-do-not-log',
                        },
                    },
                },
            }),
        )
        const api = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', fetcher)
        expect(await api.previewBaseBindings()).toEqual({
            BETTER_AUTH_SECRET: { type: 'secret_text' },
            NUXT_BETTER_AUTH_SECRET: { type: 'secret_text' },
        })
        expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET')
        expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined()
        expect(Object.keys(api)).not.toEqual(
            expect.arrayContaining([
                'setPreviewSecrets',
                'bootstrapPr',
                'deletePrResource',
                'preparePreview',
                'rollbackProductionVersion',
            ]),
        )
    })
    it.each([403, 429, 500])('fails closed for denied metadata HTTP %i', async (status) => {
        const api = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', async () =>
            response(null, status),
        )
        await expect(api.preview('development')).rejects.toThrow()
    })
})
