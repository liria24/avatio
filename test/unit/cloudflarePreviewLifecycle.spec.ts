import {
    createCloudflarePreviewCleanupPlan,
    parseCloudflarePreviewDeployment,
    verifyCloudflarePreviewCleanup,
} from '../../config/cloudflarePreviewLifecycle'
import { verifyCloudflarePreviewHttp } from '../../scripts/cloudflarePreviewSmoke'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'

const inventory = createCloudflareResourceFixture()
const target = inventory.previews!['pr-354']!
const expected = { mode: 'pr-354', siteUrl: target.siteUrl }
const result = {
    type: 'preview',
    version: 1,
    preview_id: 'preview354',
    preview_name: 'pr-354',
    preview_slug: 'pr-354',
    preview_urls: [target.siteUrl],
    deployment_id: 'version354',
    deployment_urls: ['https://version354-pr-354.previews.example.test'],
}
const pr = {
    number: 354,
    state: 'closed',
    head: { repo: { full_name: 'liria24/avatio' } },
    base: { ref: 'development', repo: { full_name: 'liria24/avatio' } },
}
const inspection = {
    accountId: inventory.accountId,
    workerName: 'avatio',
    complete: true,
    resources: {
        preview: { id: 'preview354', name: 'pr-354' },
        database: target.database,
        cache: target.cache,
        bucket: { name: target.bucket },
    },
}
const cleanup = {
    inventory,
    pr,
    inspection,
    trustedSha: 'a'.repeat(40),
    trustedRef: 'refs/heads/development',
    trustedCode: {
        branch: null,
        commit: 'a'.repeat(40),
        dirty: false,
        ci: { ref: 'refs/heads/development', commit: 'a'.repeat(40) },
    },
}
const absent = {
    ...inspection,
    resources: { ...inspection.resources, preview: null },
}

describe('native Preview version URL verification', () => {
    it('selects the immutable deployment URL rather than the stable team URL', () => {
        expect(parseCloudflarePreviewDeployment(result, expected)).toMatchObject({
            deploymentId: 'version354',
            stableUrl: target.siteUrl,
            deploymentUrl: result.deployment_urls[0],
        })
    })
    it('supports the native workers.dev shape without another account fallback', () => {
        const siteUrl = 'https://pr-354-avatio.account.workers.dev'
        expect(
            parseCloudflarePreviewDeployment(
                {
                    ...result,
                    preview_urls: [siteUrl],
                    deployment_id: '98137eba-5a9a-4d89-894d-9c916ccd8d14',
                    deployment_urls: ['https://98137eba-avatio.account.workers.dev'],
                },
                { ...expected, siteUrl },
            ).deploymentUrl,
        ).toBe('https://98137eba-avatio.account.workers.dev')
    })
    it.each([
        { preview_name: 'development' },
        { preview_slug: 'pr-355' },
        { preview_urls: ['https://avatio.me'] },
        { deployment_urls: [target.siteUrl] },
        { deployment_urls: ['https://version354-pr-355.previews.example.test'] },
        { deployment_urls: ['https://version354-pr-354.attacker.example.test'] },
        { deployment_urls: ['https://version354-pr-354.previews.example.test/path'] },
        { deployment_urls: ['https://user:password@version354-pr-354.previews.example.test'] },
        { deployment_urls: [] },
        { version: 2 },
    ])('rejects wrong or ambiguous deployment identity %j', (override) => {
        expect(() =>
            parseCloudflarePreviewDeployment({ ...result, ...override }, expected),
        ).toThrow()
    })
    it('fails closed for production, missing JSON, ports and unknown schema fields', () => {
        expect(() =>
            parseCloudflarePreviewDeployment(result, { ...expected, mode: 'production' }),
        ).toThrow()
        expect(() => parseCloudflarePreviewDeployment({}, expected)).toThrow()
        expect(() =>
            parseCloudflarePreviewDeployment({ ...result, secret: 'discard' }, expected),
        ).toThrow()
        expect(() =>
            parseCloudflarePreviewDeployment(result, {
                ...expected,
                siteUrl: `${target.siteUrl}:8443`,
            }),
        ).toThrow()
    })
})

describe('trusted PR cleanup and reopen guards', () => {
    it('resolves only reviewed dedicated resources for an exact closed PR', () => {
        expect(createCloudflarePreviewCleanupPlan(cleanup)).toEqual({
            mode: 'pr-354',
            accountId: inventory.accountId,
            workerName: 'avatio',
            retainedDatabase: target.database,
            retainedCache: target.cache,
            retainedBucket: { name: target.bucket },
            resources: inspection.resources,
        })
    })
    it('treats fully inspected absent resources as a safe retry', () => {
        const plan = createCloudflarePreviewCleanupPlan({ ...cleanup, inspection: absent })
        expect(verifyCloudflarePreviewCleanup(plan, pr, absent).absenceVerified).toBe(true)
    })
    it.each([
        { workerName: 'avatio-development' },
        { accountId: 'f'.repeat(32) },
        { complete: false },
        {
            resources: {
                ...inspection.resources,
                preview: { id: 'permanent', name: 'development' },
            },
        },
        { resources: { ...inspection.resources, database: inventory.production.database } },
        { resources: { ...inspection.resources, cache: inventory.development.cache } },
        { resources: { ...inspection.resources, bucket: { name: inventory.production.bucket } } },
        {
            resources: {
                ...inspection.resources,
                database: inventory.previews!['pr-355']!.database,
            },
        },
    ])('rejects wrong ownership and incomplete reads %j', (override) => {
        expect(() =>
            createCloudflarePreviewCleanupPlan({
                ...cleanup,
                inspection: { ...inspection, ...override },
            }),
        ).toThrow()
    })
    it('rejects forks, reopened PRs, missing inventories and untrusted checkouts', () => {
        const fork = { ...pr, head: { repo: { full_name: 'someone/fork' } } }
        expect(() => createCloudflarePreviewCleanupPlan({ ...cleanup, pr: fork })).toThrow()
        expect(() =>
            createCloudflarePreviewCleanupPlan({ ...cleanup, pr: { ...pr, state: 'open' } }),
        ).toThrow()
        expect(() =>
            createCloudflarePreviewCleanupPlan({
                ...cleanup,
                inventory: { ...inventory, previews: {} },
            }),
        ).toThrow()
        expect(() =>
            createCloudflarePreviewCleanupPlan({ ...cleanup, trustedRef: 'refs/pull/354/head' }),
        ).toThrow()
        expect(() =>
            createCloudflarePreviewCleanupPlan({
                ...cleanup,
                trustedCode: { ...cleanup.trustedCode, dirty: true },
            }),
        ).toThrow()
        expect(() =>
            createCloudflarePreviewCleanupPlan({ ...cleanup, trustedSha: 'b'.repeat(40) }),
        ).toThrow()
    })
    it('does not equate successful delete commands or 403 reads with absence', () => {
        const plan = createCloudflarePreviewCleanupPlan(cleanup)
        expect(() => verifyCloudflarePreviewCleanup(plan, pr, inspection)).toThrow()
        expect(() =>
            verifyCloudflarePreviewCleanup(plan, pr, { ...absent, complete: false }),
        ).toThrow()
        expect(() =>
            verifyCloudflarePreviewCleanup(plan, pr, { ...absent, resources: {} }),
        ).toThrow()
        expect(() =>
            verifyCloudflarePreviewCleanup(plan, { ...pr, state: 'open' }, absent),
        ).toThrow()
        expect(() => verifyCloudflarePreviewCleanup(plan, { ...pr, number: 355 }, absent)).toThrow()
    })
})

describe('read-only HTTP verification against a specific Preview deployment', () => {
    const response = (url: URL | RequestInfo) => {
        const path = new URL(url instanceof Request ? url.url : url).pathname
        if (path === '/' || path === '/en')
            return new Response(
                '<html><div id="__nuxt">Avatio SSR</div><script data-ssr="true"></script></html>',
                {
                    headers: { 'content-type': 'text/html' },
                },
            )
        if (path === '/sw.js')
            return new Response('service worker', {
                headers: { 'cache-control': 'must-revalidate' },
            })
        if (path === '/manifest.webmanifest')
            return Response.json(
                { name: 'Avatio' },
                { headers: { 'cache-control': 'must-revalidate' } },
            )
        if (path === '/api/items')
            return Response.json(
                { data: [], pagination: {} },
                { headers: { 'cache-control': 'public, max-age=60' } },
            )
        return Response.json(null, { headers: { 'cache-control': 'no-store' } })
    }
    it('uses only anonymous GETs, rejects redirects, and never logs or returns catalog bodies', async () => {
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => response(url))
        const report = await verifyCloudflarePreviewHttp(result, expected, fetcher)
        expect(report).toMatchObject({ httpVerified: true, realBindingsVerified: false })
        expect(fetcher).toHaveBeenCalledTimes(6)
        for (const [url, options] of fetcher.mock.calls) {
            expect(new URL(url instanceof Request ? url.url : url).origin).toBe(
                result.deployment_urls[0],
            )
            expect(options).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store' })
            expect(options?.headers).toBeUndefined()
        }
    })
    it('stops before network activity when deployment provenance is invalid', async () => {
        const fetcher = vi.fn<typeof fetch>()
        await expect(
            verifyCloudflarePreviewHttp({ ...result, preview_name: 'pr-355' }, expected, fetcher),
        ).rejects.toThrow()
        expect(fetcher).not.toHaveBeenCalled()
    })
    it.each(['/api/items', '/api/auth/get-session', '/sw.js', '/en'])(
        'fails a responding but broken deployment at %s',
        async (broken) => {
            const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
                if (new URL(url instanceof Request ? url.url : url).pathname === broken)
                    return new Response('{}', { headers: { 'content-type': 'application/json' } })
                return response(url)
            })
            await expect(verifyCloudflarePreviewHttp(result, expected, fetcher)).rejects.toThrow()
        },
    )
    it('does not follow an Access/login redirect or count a missing binding as success', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302 }))
        await expect(verifyCloudflarePreviewHttp(result, expected, fetcher)).rejects.toThrow(
            /HTTP operation failed/,
        )
    })
})

describe('shared Preview storage cleanup', () => {
    it('requires the shared database to survive cleanup and rejects missing or replaced data', () => {
        const shared = createCloudflareResourceFixture()
        delete shared.previews!['pr-354']
        const before = {
            ...inspection,
            resources: {
                ...inspection.resources,
                database: shared.sharedPreviewStorage.database,
                cache: shared.sharedPreviewStorage.cache,
                bucket: { name: shared.sharedPreviewStorage.bucket },
            },
        }
        const plan = createCloudflarePreviewCleanupPlan({
            ...cleanup,
            inventory: shared,
            inspection: before,
        })
        expect(plan.retainedDatabase).toEqual(shared.sharedPreviewStorage.database)
        expect(plan.retainedBucket).toEqual({ name: shared.sharedPreviewStorage.bucket })
        const after = {
            ...absent,
            resources: {
                ...absent.resources,
                database: shared.sharedPreviewStorage.database,
                cache: shared.sharedPreviewStorage.cache,
                bucket: { name: shared.sharedPreviewStorage.bucket },
            },
        }
        expect(verifyCloudflarePreviewCleanup(plan, pr, after).absenceVerified).toBe(true)
        expect(() =>
            verifyCloudflarePreviewCleanup(plan, pr, {
                ...after,
                resources: { ...after.resources, bucket: null },
            }),
        ).toThrow(/incomplete/)
        expect(() => verifyCloudflarePreviewCleanup(plan, pr, absent)).toThrow(/incomplete/)
        expect(() =>
            verifyCloudflarePreviewCleanup(plan, pr, {
                ...after,
                resources: { ...after.resources, database: inventory.production.database },
            }),
        ).toThrow(/incomplete/)
    })
})

describe('exact workers.dev UUID prefix receipt contract', () => {
    const id = '98137eba-5a9a-4d89-894d-9c916ccd8d14'
    const site = 'https://development-avatio.liry.workers.dev'
    const receipt = {
        ...result,
        preview_name: 'development',
        preview_slug: 'development',
        preview_urls: [site],
        deployment_id: id,
        deployment_urls: ['https://98137eba-avatio.liry.workers.dev'],
    }
    it('accepts the actual audited short UUID URL while retaining the full UUID identity', () => {
        expect(
            parseCloudflarePreviewDeployment(receipt, { mode: 'development', siteUrl: site }),
        ).toMatchObject({ deploymentId: id, deploymentUrl: receipt.deployment_urls[0] })
    })
    it.each([
        'https://98137ebb-avatio.liry.workers.dev',
        'https://98137eba-avatio.another.workers.dev',
        'https://98137eba-other.liry.workers.dev',
        'https://98137eba-development-avatio.liry.workers.dev',
        'https://98137eba-5a9a-4d89-894d-9c916ccd8d14-avatio.liry.workers.dev',
        site,
        'https://avatio.liry.workers.dev',
        'https://98137eba-avatio.liry.workers.dev/path',
        'https://98137eba-avatio.liry.workers.dev?secret=synthetic',
        'https://user:secret@98137eba-avatio.liry.workers.dev',
        'https://98137eba-avatio.liry.workers.dev:8443',
    ])('rejects unsupported or foreign URL %s', (url) => {
        expect(() =>
            parseCloudflarePreviewDeployment(
                { ...receipt, deployment_urls: [url] },
                { mode: 'development', siteUrl: site },
            ),
        ).toThrow()
    })
    it.each(['98137eba', 'version354', 'latest'])(
        'requires a full UUID rather than %s',
        (deployment_id) => {
            expect(() =>
                parseCloudflarePreviewDeployment(
                    { ...receipt, deployment_id },
                    { mode: 'development', siteUrl: site },
                ),
            ).toThrow()
        },
    )
    it('rejects another Preview even though workers.dev does not encode its name', () => {
        expect(() =>
            parseCloudflarePreviewDeployment(
                { ...receipt, preview_name: 'pr-354', preview_slug: 'pr-354' },
                { mode: 'development', siteUrl: site },
            ),
        ).toThrow()
    })
})
