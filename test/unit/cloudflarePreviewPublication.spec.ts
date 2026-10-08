import { resolve } from 'node:path'

import { createCloudflareConfig, getCloudflareTargetResources } from '../../config/cloudflare'
import type { CloudflareDeliveryEvidence } from '../../config/cloudflareDelivery'
import { createCloudflarePublishPlan } from '../../config/cloudflarePublisher'
import { createCloudflareNativeApi } from '../../scripts/cloudflareNativeApi'
import {
    publishCloudflareNative,
    publishCloudflarePreviewArtifact,
    verifyCloudflarePreviewBase,
    cleanupCloudflareNativePr,
    migrateCloudflareSharedPreview,
} from '../../scripts/cloudflareNativePublication'
import { createCloudflareResourceFixture } from '../helpers/cloudflareResources'
const inventory = createCloudflareResourceFixture()
const sha = 'a'.repeat(40)
const names = ['20260801000000_initial/migration.sql', '20260802000000_update/migration.sql']
const evidence = (mode: string): CloudflareDeliveryEvidence => ({
    repository: 'liria24/avatio',
    sourceRepository: 'liria24/avatio',
    eventName: mode.startsWith('pr-') ? 'workflow_run' : 'push',
    ref: mode.startsWith('pr-')
        ? `refs/pull/${mode.slice(3)}/head`
        : `refs/heads/${mode === 'production' ? 'main' : mode}`,
    mode,
    sourceSha: sha,
    latestSourceSha: sha,
    trustedCodeSha: sha,
    checkedOutCodeSha: sha,
    trustedCodeRef: 'refs/heads/main',
    buildSucceeded: true,
    build: { sourceSha: sha, mode, isPreview: mode !== 'production', workerName: 'avatio' },
    state: { branch: null, commit: sha, dirty: false, ci: { ref: 'refs/heads/main', commit: sha } },
})
const output = (mode: string, resourceInventory = inventory) => {
    const config = createCloudflareConfig(
        { mode, isPreview: mode !== 'production' },
        resourceInventory,
    )
    const { entrypoint: _entrypoint, ...worker } = config.worker
    return {
        version: 'v0',
        containers: [],
        rootConfig: {
            accountId: inventory.accountId,
            buildContext: { mode, isPreview: mode !== 'production' },
        },
        workers: {
            default: {
                config: {
                    ...worker,
                    manifest: {
                        type: 'complete',
                        mainModule: 'index.js',
                        modules: { 'index.js': { type: 'esm' } },
                    },
                },
                bundleDir: resolve('synthetic/bundle'),
                assetsDir: resolve('synthetic/assets'),
            },
        },
    }
}
const plan = (mode = 'pr-354', resourceInventory = inventory) =>
    createCloudflarePublishPlan({
        evidence: evidence(mode),
        inventory: resourceInventory,
        buildOutput: output(mode, resourceInventory),
        migrationNames: names,
    })

const fixture = (mode = 'pr-356') => {
    const selected = plan(mode)
    const target = getCloudflareTargetResources(mode, inventory)
    const bindings = createCloudflareConfig({ mode, isPreview: mode !== 'production' }, inventory)
        .worker.env
    const env: Record<string, Record<string, unknown>> = Object.fromEntries(
        Object.entries(bindings).map(([name, binding]) => {
            switch (binding.type) {
                case 'text':
                    return [name, { type: 'plain_text', text: binding.value }]
                case 'secret':
                    return [name, { type: 'secret_text' }]
                case 'd1':
                    return [
                        name,
                        { type: 'd1', database_id: binding.id, database_name: binding.name },
                    ]
                case 'kv':
                    return [name, { type: 'kv_namespace', namespace_id: binding.id }]
                case 'r2':
                    return [name, { type: 'r2_bucket', bucket_name: binding.name }]
                case 'flagship':
                    return [name, { type: 'flagship', app_id: binding.id }]
                case 'rate-limit':
                    return [
                        name,
                        {
                            type: 'ratelimit',
                            namespace_id: binding.namespace,
                            simple: binding.simple,
                        },
                    ]
                case 'send-email':
                    return [
                        name,
                        {
                            type: 'send_email',
                            allowed_sender_addresses: binding.allowedSenderAddresses,
                            allowed_destination_addresses: binding.allowedDestinationAddresses,
                        },
                    ]
                default:
                    return [name, { type: binding.type }]
            }
        }),
    )

    const cli = {
        type: 'preview',
        version: 1,
        preview_id: 'preview',
        preview_name: mode,
        preview_slug: mode,
        preview_urls: [target.siteUrl],
        deployment_id: 'version',
        deployment_urls: [`https://version-${mode}.previews.example.test`],
    }
    const exact = {
        id: 'version',
        preview_id: 'preview',
        preview_name: mode,
        urls: cli.deployment_urls,
        parentAssociation: 'verified-preview-endpoint' as const,
        sourceSha: undefined as unknown,
        env,
    }
    const client = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', async () => {
        throw new Error('Unexpected network')
    })
    const api = {
        ...client,
        previewBaseBindings: vi.fn(async () => ({
            NUXT_BETTER_AUTH_SECRET: { type: 'secret_text' },
        })),
        inspect: vi.fn(async () => ({
            complete: true as const,
            accountId: inventory.accountId,
            workerName: 'avatio' as const,
            resources: {
                preview: null,
                database: target.database,
                cache: target.cache,
                bucket: { name: target.bucket },
            },
        })),
        query: vi.fn(async (_id: string, sql: string) =>
            sql.includes('sqlite_schema')
                ? [{ name: 'd1_migrations' }]
                : names.map((name) => ({ name })),
        ),
        preview: vi.fn(async () => ({ id: 'preview', name: mode, slug: mode })),
        previewDeployment: vi.fn(async () => exact),
        deletePreview: vi.fn(async () => {}),
    }
    const run = vi.fn(async (command: typeof selected.apply) => ({
        exitCode: 0,
        signal: null,
        output:
            command === selected.apply
                ? names.map((name) => ({ name, status: '✅' }))
                : command === selected.pending
                  ? []
                  : cli,
    }))
    const httpFetch = vi.fn<typeof fetch>(async (url) => {
        const path = new URL(url instanceof Request ? url.url : String(url)).pathname
        if (path === '/' || path === '/en')
            return new Response('<html data-ssr="true">__nuxt</html>', {
                headers: { 'content-type': 'text/html' },
            })
        if (path === '/api/items')
            return Response.json(
                { data: [], pagination: {} },
                { headers: { 'cache-control': 'public,max-age=0' } },
            )
        if (path === '/api/auth/get-session')
            return Response.json(null, { headers: { 'cache-control': 'no-store' } })
        return new Response(path.endsWith('webmanifest') ? '{}' : 'self.addEventListener', {
            headers: { 'cache-control': 'must-revalidate' },
        })
    })
    const input = {
        inventory,
        api,
        run,
        httpFetch,
        enabled: true,
        manualDevelopmentApproved: false,
        sharedMigrationsCompatible: true,
        latestSourceSha: vi.fn(async () => sha),
        reportPublication: vi.fn(),
        reportDiagnostic: vi.fn(),
    }
    return { selected, input, exact, cli, env }
}

describe('single publication with preconfigured Preview secrets', () => {
    it('publishes once, reads the full CLI deployment ID, verifies all inherited bindings and only then checks immutable HTTP', async () => {
        const { selected, input } = fixture()
        expect(await publishCloudflareNative(selected, input)).toMatchObject({
            publicationVerified: true,
            sourceSha: sha,
            deploymentId: 'version',
        })
        expect(input.run).toHaveBeenCalledExactlyOnceWith(selected.deploy)
        expect(input.api.previewDeployment).toHaveBeenCalledWith(
            'pr-356',
            'version',
            false,
            'preview',
        )
        expect(input.api.previewDeployment).toHaveBeenCalledWith(
            'pr-356',
            'latest',
            false,
            'preview',
        )
        expect(input.reportPublication.mock.calls.map(([receipt]) => receipt.stage)).toEqual([
            'cli-receipt',
            'bindings-verified',
            'http-verified',
        ])
        expect(
            input.httpFetch.mock.calls.every(
                ([url, init]) =>
                    new URL(url instanceof Request ? url.url : url).origin ===
                        'https://version-pr-356.previews.example.test' &&
                    init?.method === 'GET' &&
                    init.redirect === 'error',
            ),
        ).toBe(true)
    })
    it('applies migrations only for preprovisioned isolated data, before publication', async () => {
        const { selected, input } = fixture('pr-354')
        await publishCloudflareNative(selected, input)
        expect(input.run.mock.calls.map(([command]) => command)).toEqual([
            selected.apply,
            selected.pending,
            selected.deploy,
        ])
    })
    it('does no remote work for disabled delivery or production HOLD', async () => {
        for (const mode of ['pr-356', 'production']) {
            const { selected, input } = fixture(mode)
            input.enabled = false
            await expect(publishCloudflareNative(selected, input)).rejects.toThrow()
            expect(input.api.previewBaseBindings).not.toHaveBeenCalled()
            expect(input.run).not.toHaveBeenCalled()
        }
    })
    it('rejects incompatible PR migrations before any remote action', async () => {
        const { selected, input } = fixture()
        input.sharedMigrationsCompatible = false
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/trusted base/)
        expect(input.run).not.toHaveBeenCalled()
        expect(input.api.inspect).not.toHaveBeenCalled()
    })
    it('never migrates shared D1 even if it lacks the final base migration', async () => {
        const { selected, input } = fixture()
        input.api.query.mockImplementation(async (_id, sql) =>
            sql.includes('sqlite_schema') ? [{ name: 'd1_migrations' }] : [{ name: names[0]! }],
        )
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/already-applied/)
        expect(input.run).not.toHaveBeenCalled()
    })
    it('rejects populated data without reconciled ledger and never creates one', async () => {
        const { selected, input } = fixture()
        input.api.query.mockResolvedValue([{ name: 'users' }])
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/reconciled/)
        expect(input.run).not.toHaveBeenCalled()
    })
    it('requires one-time owner initialization for existing incomplete Preview secrets', async () => {
        const { selected, input, env } = fixture('development')
        input.api.inspect.mockResolvedValue({
            ...(await input.api.inspect()),
            resources: {
                ...(await input.api.inspect()).resources,
                preview: { id: 'preview', name: 'development', slug: 'development' },
            },
        } as never)
        delete env.TWITTER_CLIENT_SECRET
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow()
        expect(input.reportDiagnostic).toHaveBeenLastCalledWith({
            phase: 'existing-preview',
            outcome: 'failed',
            code: 'operation-failed',
        })
        expect(input.run).not.toHaveBeenCalled()
    })
    it.each([
        'parent',
        'id',
        'source',
        'url',
        'bindings',
        'extra-secret',
        'twitter',
        'email',
        'og',
    ])('retains partial CLI evidence but rejects unexpected %s before HTTP', async (kind) => {
        const { selected, input, exact, env } = fixture()
        if (kind === 'parent')
            input.api.preview.mockResolvedValue({
                id: 'replacement',
                name: 'pr-356',
                slug: 'pr-356',
            })
        if (kind === 'id') exact.id = 'different'
        if (kind === 'source') exact.sourceSha = 'b'.repeat(40)
        if (kind === 'url') exact.urls = ['https://wrong.example.test']
        if (kind === 'bindings') env.APP_DB!.database_id = inventory.production.database.id
        if (kind === 'extra-secret')
            env.PRODUCTION_SECRET = { type: 'secret_text', text: 'never-log' }
        if (kind === 'twitter')
            env.TWITTER_CLIENT_SECRET = { type: 'secret_text', text: 'never-log' }
        if (kind === 'email') env.EMAIL = { type: 'send_email' }
        if (kind === 'og') env.OG_IMAGE_SECRET = { type: 'secret_text', text: 'never-log' }
        await expect(publishCloudflarePreviewArtifact(selected, input)).rejects.toThrow()
        expect(input.reportPublication.mock.calls[0]?.[0].stage).toBe('cli-receipt')
        expect(input.httpFetch).not.toHaveBeenCalled()
        expect(JSON.stringify(input.reportDiagnostic.mock.calls)).not.toContain('never-log')
    })
    it('does not claim success if immutable HTTP or final latest read fails', async () => {
        const { selected, input, exact } = fixture()
        input.api.previewDeployment
            .mockResolvedValueOnce(exact)
            .mockResolvedValue({ ...exact, id: 'replacement' })
        await expect(publishCloudflarePreviewArtifact(selected, input)).rejects.toThrow(/latest/)
        expect(input.reportPublication.mock.calls.map(([receipt]) => receipt.stage)).toEqual([
            'cli-receipt',
            'bindings-verified',
        ])
    })
    it('rejects stale source before and after migration without deploying', async () => {
        const { selected, input } = fixture('pr-354')
        input.latestSourceSha.mockResolvedValueOnce(sha).mockResolvedValue('b'.repeat(40))
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/Source changed/)
        expect(input.run).not.toHaveBeenCalledWith(selected.deploy)
    })
})

describe('Base inheritance allowlist', () => {
    it('requires exactly the common auth secret names/types without values', () => {
        expect(
            verifyCloudflarePreviewBase(
                {
                    NUXT_BETTER_AUTH_SECRET: { type: 'secret_text' },
                },
                inventory,
            ),
        ).toEqual({ baseVerified: true })
    })
    it.each([
        'BETTER_AUTH_SECRET',
        'TWITTER_CLIENT_SECRET',
        'OG_IMAGE_SECRET',
        'EMAIL',
        'ITEM_REVALIDATION_QUEUE',
        'CLOUDFLARE_ANALYTICS_READ_TOKEN',
        'UNKNOWN_SECRET',
    ])('rejects inherited %s even when omitted from PR config', (name) => {
        const env = {
            NUXT_BETTER_AUTH_SECRET: { type: 'secret_text' },
            [name]: { type: 'secret_text', text: 'never-log' },
        }
        expect(() => verifyCloudflarePreviewBase(env, inventory)).toThrow()
    })
    it.each(['NUXT_BETTER_AUTH_SECRET'])('rejects absent or plain-text %s', (name) => {
        const env: Record<string, unknown> = {
            NUXT_BETTER_AUTH_SECRET: { type: 'secret_text' },
        }
        const absent = Object.fromEntries(Object.entries(env).filter(([key]) => key !== name))
        expect(() => verifyCloudflarePreviewBase(absent, inventory)).toThrow()
        env[name] = { type: 'plain_text', text: 'never-log' }
        expect(() => verifyCloudflarePreviewBase(env, inventory)).toThrow()
    })
    it.each(['APP_DB', 'CONTENT_CACHE', 'R2'])(
        'rejects inherited production data for %s',
        (name) => {
            const { env } = fixture('production')
            expect(() =>
                verifyCloudflarePreviewBase(
                    {
                        NUXT_BETTER_AUTH_SECRET: { type: 'secret_text' },
                        [name]: env[name],
                    },
                    inventory,
                ),
            ).toThrow()
        },
    )
})

describe('preprovisioned PR resource preservation', () => {
    it('deletes only the closed PR Preview and verifies shared data identities survive', async () => {
        const { input } = fixture()
        let present = true
        const inspected = await input.api.inspect()
        input.api.inspect.mockImplementation(
            async () =>
                ({
                    ...inspected,
                    resources: {
                        ...inspected.resources,
                        preview: present ? { id: 'preview', name: 'pr-356', slug: 'pr-356' } : null,
                    },
                }) as never,
        )
        input.api.deletePreview.mockImplementation(async () => {
            present = false
        })
        const readPr = vi.fn(async () => ({
            number: 356,
            state: 'closed',
            head: { repo: { full_name: 'liria24/avatio' } },
            base: { ref: 'main', repo: { full_name: 'liria24/avatio' } },
        }))
        expect(
            await cleanupCloudflareNativePr({
                inventory,
                enabled: true,
                mode: 'pr-356',
                trustedRef: 'refs/heads/main',
                trustedSha: sha,
                trustedCode: {
                    branch: null,
                    commit: sha,
                    dirty: false,
                    ci: { ref: 'refs/heads/main', commit: sha },
                },
                api: input.api,
                readPr,
            }),
        ).toEqual({ mode: 'pr-356', absenceVerified: true })
        expect(input.api.deletePreview).toHaveBeenCalledExactlyOnceWith('pr-356', 'preview')
        expect(input.api.query).not.toHaveBeenCalled()
        expect(input.run).not.toHaveBeenCalled()
    })
})

describe('serialized trusted-base shared migrations without publication', () => {
    const arrange = () => {
        const { input } = fixture()
        const run = vi.fn<Parameters<typeof migrateCloudflareSharedPreview>[0]['run']>(
            async (command) => ({
                exitCode: 0,
                signal: null,
                output:
                    command.args[3] === 'apply'
                        ? names.map((name) => ({ name, status: '✅' }))
                        : [],
            }),
        )
        return {
            ...input,
            run,
            sourceSha: sha,
            migrationNames: names,
            manualDevelopmentApproved: true,
        }
    }
    it('applies reviewed base migrations once to the fixed shared D1 and confirms complete bookkeeping; never publishes', async () => {
        const input = arrange()
        expect(await migrateCloudflareSharedPreview(input)).toEqual({
            sourceSha: sha,
            sharedMigrationsVerified: true,
            publicationPerformed: false,
        })
        expect(input.run.mock.calls.map(([command]) => command.args.slice(1, 5))).toEqual([
            ['d1', 'migrations', 'apply', inventory.sharedPreviewStorage.database.id],
            ['d1', 'migrations', 'list', inventory.sharedPreviewStorage.database.id],
        ])
        expect(
            input.api.query.mock.calls.every(
                ([id]) => id === inventory.sharedPreviewStorage.database.id,
            ),
        ).toBe(true)
        expect(input.api.previewBaseBindings).not.toHaveBeenCalled()
        expect(input.api.deletePreview).not.toHaveBeenCalled()
        expect(input.httpFetch).not.toHaveBeenCalled()
    })
    it('rejects unapproved and stale source before touching resources', async () => {
        for (const approved of [false, true]) {
            const input = arrange()
            input.manualDevelopmentApproved = approved
            input.latestSourceSha.mockResolvedValue('b'.repeat(40))
            await expect(migrateCloudflareSharedPreview(input)).rejects.toThrow()
            expect(input.api.inspect).not.toHaveBeenCalled()
            expect(input.run).not.toHaveBeenCalled()
        }
    })
    it('stops after a hung/failed apply without a pending command or publication', async () => {
        const input = arrange()
        input.run.mockResolvedValue({ exitCode: null, signal: 'SIGTERM', output: [] })
        await expect(migrateCloudflareSharedPreview(input)).rejects.toThrow(/exit normally/)
        expect(input.reportDiagnostic).toHaveBeenLastCalledWith({
            phase: 'migration-apply',
            outcome: 'failed',
            code: 'operation-failed',
        })
        expect(input.run).toHaveBeenCalledTimes(1)
        expect(input.httpFetch).not.toHaveBeenCalled()
    })
    it.each(['populated', 'prefix', 'missing-resource', 'post-ledger', 'stale-before-apply'])(
        'refuses %s without manufacturing successful migration evidence',
        async (kind) => {
            const input = arrange()
            if (kind === 'populated') input.api.query.mockResolvedValue([{ name: 'users' }])
            if (kind === 'prefix')
                input.api.query.mockImplementation(async (_id, sql) =>
                    sql.includes('sqlite_schema')
                        ? [{ name: 'd1_migrations' }]
                        : [{ name: 'unexpected.sql' }],
                )
            if (kind === 'missing-resource')
                input.api.inspect.mockResolvedValue({
                    ...(await input.api.inspect()),
                    resources: { ...(await input.api.inspect()).resources, database: null },
                } as never)
            if (kind === 'post-ledger')
                input.api.query
                    .mockResolvedValueOnce([{ name: 'd1_migrations' }])
                    .mockResolvedValueOnce(names.map((name) => ({ name })))
                    .mockResolvedValue([])
            if (kind === 'stale-before-apply')
                input.latestSourceSha.mockResolvedValueOnce(sha).mockResolvedValue('b'.repeat(40))
            await expect(migrateCloudflareSharedPreview(input)).rejects.toThrow()
            if (kind !== 'post-ledger') expect(input.run).not.toHaveBeenCalled()
            expect(input.httpFetch).not.toHaveBeenCalled()
        },
    )
})
