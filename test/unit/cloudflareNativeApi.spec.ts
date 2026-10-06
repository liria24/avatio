import { createCloudflareConfig } from '../../config/cloudflare'
import {
    cloudflareInventoryHash,
    requireCloudflareActivation,
} from '../../config/cloudflareActivation'
import {
    createCloudflareNativeApi,
    verifyCloudflarePreviewBindings,
} from '../../scripts/cloudflareNativeApi'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
const address = (value: Parameters<typeof fetch>[0]) =>
    typeof value === 'string' ? value : value instanceof URL ? value.href : value.url
const bodyText = (value: BodyInit | null | undefined) => {
    if (typeof value !== 'string') throw new Error('Expected a JSON string request body')
    return value
}
const sha = 'a'.repeat(40)
const now = Date.parse('2026-10-06T07:00:00Z')
const expected = {
    action: 'deploy' as const,
    mode: 'pr-354',
    sourceSha: sha,
    trustedCodeSha: sha,
    inventory,
    enabled: true,
}
const approval = () => ({
    version: 1,
    repository: 'liria24/avatio',
    ...expected,
    inventory: undefined,
    enabled: undefined,
    inventoryHash: cloudflareInventoryHash(inventory),
    expiresAt: '2026-10-06T08:00:00Z',
    proofs: {
        buildAndBindings: 'https://github.com/liria24/avatio/actions/runs/1',
        previewIsolationAndSecrets: 'https://github.com/liria24/avatio/actions/runs/2',
        migrationHistoryAndRecovery: 'https://github.com/liria24/avatio/actions/runs/3',
        environmentProtection: 'https://github.com/liria24/avatio/actions/runs/4',
        singlePublisher: 'https://github.com/liria24/avatio/actions/runs/5',
    },
    previewSecretTransferApproved: true,
    buildArtifactPublicationApproved: false,
    ephemeralDeletionApproved: false,
    resourceCreationApproved: false,
    productionCutoverApproved: false,
})
const cleanApproval = () => {
    const { inventory: _inventory, enabled: _enabled, ...result } = approval()
    return result
}
const response = (result: unknown, status = 200) =>
    new Response(JSON.stringify({ success: status === 200, result }), {
        status,
        headers: { 'content-type': 'application/json' },
    })

describe('protected native activation evidence', () => {
    it('accepts only exact short-lived reviewed inputs', () => {
        expect(requireCloudflareActivation(cleanApproval(), expected, now).mode).toBe('pr-354')
    })
    it.each([
        { enabled: false },
        { mode: 'production' },
        { sourceSha: 'b'.repeat(40) },
        { trustedCodeSha: 'b'.repeat(40) },
        { inventory: { ...inventory, accountId: 'b'.repeat(32) } },
    ])('stops mismatched or inactive execution before any effect (%j)', (patch) => {
        expect(() =>
            requireCloudflareActivation(cleanApproval(), { ...expected, ...patch }, now),
        ).toThrow()
    })
    it.each([
        { expiresAt: '2026-10-06T07:00:00Z' },
        { expiresAt: '2026-10-08T07:00:00Z' },
        { previewSecretTransferApproved: false },
        { repository: 'attacker/avatio' },
        { unexpected: true },
        { proofs: {} },
    ])('rejects expired, broad or incomplete approvals (%j)', (patch) => {
        expect(() =>
            requireCloudflareActivation({ ...cleanApproval(), ...patch }, expected, now),
        ).toThrow()
    })
    it('requires separate production, bootstrap and deletion authorization', () => {
        for (const action of ['cleanup', 'bootstrap'] as const)
            expect(() =>
                requireCloudflareActivation(
                    { ...cleanApproval(), action },
                    { ...expected, action },
                    now,
                ),
            ).toThrow()
        expect(() =>
            requireCloudflareActivation(
                { ...cleanApproval(), mode: 'production' },
                { ...expected, mode: 'production' },
                now,
            ),
        ).toThrow()
    })
})

describe('native Cloudflare REST boundary', () => {
    it('creates a named Preview without inheriting the production base', async () => {
        const calls: { url: string; init?: RequestInit }[] = []
        const fetcher: typeof fetch = async (url, init) => {
            calls.push({ url: address(url), init })
            return init?.method === 'GET'
                ? response(null, 404)
                : response({ id: 'p354', name: 'pr-354', slug: 'pr-354' })
        }
        const api = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', fetcher)
        await api.preparePreview('pr-354')
        expect(calls).toHaveLength(2)
        expect(
            calls[1]?.url.endsWith('/workers/workers/avatio/previews?ignore_base_config=true'),
        ).toBe(true)
        expect(JSON.parse(bodyText(calls[1]?.init?.body))).toEqual({ name: 'pr-354' })
        expect(calls.every(({ init }) => init?.redirect === 'error')).toBe(true)
    })
    it.each([403, 429, 500])('never treats HTTP %i as a missing Preview', async (status) => {
        const fetcher = vi.fn<typeof fetch>(async () => response(null, status))
        const api = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', fetcher)
        await expect(api.preparePreview('pr-354')).rejects.toThrow()
        expect(fetcher).toHaveBeenCalledTimes(1)
    })
    it('reuses exactly the same PR identity on updates', async () => {
        const fetcher = vi.fn<typeof fetch>(async () =>
            response({ id: 'p354', name: 'pr-354', slug: 'pr-354' }),
        )
        await createCloudflareNativeApi(
            inventory.accountId,
            'synthetic-token',
            fetcher,
        ).preparePreview('pr-354')
        expect(fetcher).toHaveBeenCalledTimes(1)
    })
    it('refuses an existing Preview belonging to another PR', async () => {
        const api = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', async () =>
            response({ id: 'p355', name: 'pr-355', slug: 'pr-355' }),
        )
        await expect(api.preparePreview('pr-354')).rejects.toThrow(/ownership/)
    })
    it('strips echoed secret values and binds secret PATCH to a specific Preview version', async () => {
        const calls: string[] = []
        const api = createCloudflareNativeApi(
            inventory.accountId,
            'synthetic-token',
            async (url, init) => {
                calls.push(`${init?.method} ${address(url)}`)
                if (init?.method === 'PATCH') {
                    expect(init.headers).toMatchObject({
                        'content-type': 'application/merge-patch+json',
                    })
                    expect(JSON.parse(bodyText(init.body))).toEqual({
                        env: {
                            BETTER_AUTH_SECRET: { type: 'secret_text', text: 'synthetic-only' },
                        },
                    })
                }
                return response({
                    id: 'v354',
                    preview_name: 'pr-354',
                    env: {
                        BETTER_AUTH_SECRET: { type: 'secret_text', text: 'synthetic-only' },
                        STAGE: { type: 'plain_text', text: 'development' },
                    },
                })
            },
        )
        await api.setPreviewSecrets('pr-354', 'v354', { BETTER_AUTH_SECRET: 'synthetic-only' })
        const value = await api.previewDeployment('pr-354', 'v354')
        expect(JSON.stringify(value)).not.toContain('synthetic-only')
        expect(calls.every((url) => url.endsWith('/pr-354/deployments/v354'))).toBe(true)
    })
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
    it('does not allocate replacements after a denied identity read', async () => {
        const fetcher = vi.fn<typeof fetch>(async () => response(null, 403))
        await expect(
            createCloudflareNativeApi(inventory.accountId, 'synthetic-token', fetcher).bootstrapPr(
                'pr-354',
                inventory.sharedPreviewStorage,
            ),
        ).rejects.toThrow()
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

describe('shared storage deletion guard', () => {
    it.each(['database', 'bucket'] as const)(
        'refuses shared %s deletion before making any API call',
        async (kind) => {
            const shared = createCloudflareResourceFixture()
            Object.assign(shared.previews!['pr-354']!, structuredClone(shared.sharedPreviewStorage))
            const fetcher = vi.fn<typeof fetch>()
            const api = createCloudflareNativeApi(shared.accountId, 'synthetic-token', fetcher)
            await expect(api.deletePrResource('pr-354', kind, shared)).rejects.toThrow(
                /never be deleted/,
            )
            expect(fetcher).not.toHaveBeenCalled()
        },
    )
})

describe('shared Preview storage bootstrap', () => {
    it('reuses existing shared D1 and R2 without allocating either', async () => {
        const name = 'avatio-pr-354'
        const database = inventory.sharedPreviewStorage.database
        const fetcher = vi.fn<typeof fetch>(async (url, init) => {
            expect(init?.method).toBe('GET')
            const path = new URL(address(url)).pathname
            if (path.endsWith(`/d1/database/${database.id}`))
                return response({ uuid: database.id, name: database.name })
            if (path.endsWith('/storage/kv/namespaces'))
                return response([{ id: '3'.repeat(32), title: name }])
            if (path.endsWith(`/r2/buckets/${inventory.sharedPreviewStorage.bucket}`))
                return response({ name: inventory.sharedPreviewStorage.bucket })
            throw new Error('Unexpected bootstrap request')
        })
        const result = await createCloudflareNativeApi(
            inventory.accountId,
            'synthetic-token',
            fetcher,
        ).bootstrapPr('pr-354', inventory.sharedPreviewStorage)
        expect(result.database).toEqual(database)
        expect(result.bucket).toBe(inventory.sharedPreviewStorage.bucket)
        expect(fetcher).toHaveBeenCalledTimes(3)
    })
})
