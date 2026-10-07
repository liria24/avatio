import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

import { createCloudflareConfig } from '../../config/cloudflare'
import { cloudflareInventoryHash } from '../../config/cloudflareActivation'
import { validateCloudflareBuildOutput } from '../../config/cloudflareBuildOutput'
import type { CloudflareDeliveryEvidence } from '../../config/cloudflareDelivery'
import {
    confirmCloudflarePublisherMigrations,
    createCloudflarePublishPlan,
    simulateCloudflarePublication,
    verifyCloudflarePublisherResources,
} from '../../config/cloudflarePublisher'
import { createCloudflareNativeApi } from '../../scripts/cloudflareNativeApi'
import {
    publishCloudflareNative,
    prepareCloudflareRuntimeSecrets,
} from '../../scripts/cloudflareNativePublication'
import { rehearseCloudflareDevelopment } from '../../scripts/cloudflareRehearseDevelopment'
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
const receipt = () => ({
    accountId: inventory.accountId,
    databaseId: inventory.previews!['pr-354']!.database.id,
    apply: { exitCode: 0, output: names.map((name) => ({ name, status: '✅' })) },
    pending: { exitCode: 0, output: [] },
    appliedNames: names,
})
const deployment = {
    type: 'preview',
    version: 1,
    preview_id: 'preview354',
    preview_name: 'pr-354',
    preview_slug: 'pr-354',
    preview_urls: [inventory.previews!['pr-354']!.siteUrl],
    deployment_id: 'version354',
    deployment_urls: ['https://version354-pr-354.previews.example.test'],
}

const runtimeInput = {
    BETTER_AUTH_SECRET: 'synthetic-signing-key-'.repeat(3),
    OG_IMAGE_SECRET: 'synthetic-og-signing-key',
    TWITTER_CLIENT_SECRET: 'synthetic-oauth',
}
const activation = () => ({
    version: 1,
    repository: 'liria24/avatio',
    action: 'deploy',
    mode: 'pr-354',
    sourceSha: sha,
    trustedCodeSha: sha,
    inventoryHash: cloudflareInventoryHash(inventory),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
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
const nativeFixture = (mode = 'pr-354') => {
    const selected = plan(mode)
    const targetDeployment = {
        ...deployment,
        preview_name: mode,
        preview_slug: mode,
        preview_urls: [
            mode === 'development' ? inventory.development.siteUrl : deployment.preview_urls[0]!,
        ],
        deployment_urls: [`https://version354-${mode}.previews.example.test`],
    }
    const events: string[] = []
    const bindings = createCloudflareConfig({ mode, isPreview: true }, inventory).worker.env
    const rawEnv: Record<string, Record<string, unknown>> = Object.fromEntries(
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
    const client = createCloudflareNativeApi(inventory.accountId, 'synthetic-token', async () => {
        throw new Error('No unexpected external API call permitted')
    })
    const api = {
        ...client,
        inspect: vi.fn(async () => ({
            accountId: inventory.accountId,
            workerName: 'avatio' as const,
            complete: true as const,
            resources: {
                preview: null,
                database: selected.resources.database,
                cache: selected.resources.cache,
                bucket: selected.resources.bucket,
            },
        })),
        query: vi.fn(async (_id: string, sql: string) => {
            events.push('query')
            return sql.includes('sqlite_schema') ? [] : names.map((name) => ({ name }))
        }),
        preparePreview: vi.fn(async () => {
            events.push('prepare-preview')
            return { id: 'preview354', name: mode, slug: mode }
        }),
        createInitialDevelopmentPreview: vi.fn(async () => {
            events.push('create-initial-preview')
            return { id: 'preview354', name: 'development', slug: 'development' }
        }),
        preview: vi.fn(async () => ({ id: 'preview354', name: mode, slug: mode })),
        setPreviewSecrets: vi.fn(async () => {
            events.push('secrets')
        }),
        previewDeployment: vi.fn(async (_mode: string, version: string) =>
            version === 'latest'
                ? null
                : {
                      id: 'version354',
                      preview_name: mode,
                      env: rawEnv,
                  },
        ),
    }
    const run = vi.fn(
        async (
            command: typeof selected.apply,
        ): Promise<{ exitCode: number | null; signal: string | null; output: unknown }> => {
            events.push(
                command === selected.apply
                    ? 'apply'
                    : command === selected.pending
                      ? 'pending'
                      : 'deploy',
            )
            return {
                exitCode: 0,
                signal: null,
                output:
                    command === selected.apply
                        ? names.map((name) => ({ name, status: '✅' }))
                        : command === selected.pending
                          ? []
                          : targetDeployment,
            }
        },
    )
    const httpFetch: typeof fetch = async (url) => {
        events.push('http')
        const path = new URL(
            typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
        ).pathname
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
    }
    const input = {
        inventory,
        activation: activation(),
        enabled: true,
        trustedCodeSha: sha,
        runtimeSecrets: prepareCloudflareRuntimeSecrets(selected, inventory, runtimeInput),
        api,
        run,
        latestSourceSha: vi.fn(async () => sha),
        verifyProduction: vi.fn(async () => {}),
        httpFetch,
    }
    return { selected, input, events }
}

describe('separately approved initial development runtime rehearsal', () => {
    const fixture = () => {
        const value = nativeFixture('development')
        const files = names.map((name, index) => {
            const sql = `CREATE TABLE example${index} (id INTEGER PRIMARY KEY);`
            return { name, sql, hash: createHash('sha256').update(sql).digest('hex') }
        })
        const schema = [
            {
                type: 'table',
                name: '__alchemy_migrations',
                tableName: '__alchemy_migrations',
                sql: 'CREATE TABLE __alchemy_migrations (id INTEGER PRIMARY KEY, name TEXT, hash TEXT, applied_at TEXT)',
            },
        ]
        const alchemy = files.map((file, index) => ({
            id: index + 1,
            name: file.name,
            hash: file.hash,
            appliedAt: '2026-10-01 00:00:00',
        }))
        value.input.api.query.mockImplementation(async (_id, sql) => {
            if (!sql.startsWith('SELECT ')) throw new Error('Unexpected SQL mutation')
            return structuredClone(sql.includes('sqlite_schema') ? schema : alchemy)
        })
        const approval = {
            version: 1,
            repository: 'liria24/avatio',
            action: 'rehearse',
            mode: 'development',
            sourceSha: sha,
            trustedCodeSha: sha,
            qualityRunId: '1234',
            inventoryHash: cloudflareInventoryHash(inventory),
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            buildArtifactPublicationApproved: true,
            previewSecretTransferApproved: true,
            incidentalNonProductionRuntimeWritesApproved: true,
            publicInitialPreviewApproved: true,
        }
        const input = {
            ...value.input,
            approval,
            files,
            filesSha: sha,
            expected: {
                action: 'rehearse',
                mode: 'development',
                eventName: 'workflow_dispatch',
                sourceRef: 'refs/heads/development',
                trustedRef: 'refs/heads/development',
                sourceSha: sha,
                latestSourceSha: sha,
                trustedCodeSha: sha,
                quality: { runId: '1234', sourceSha: sha, succeeded: true },
                inventory,
            },
        }
        return { ...value, input, schema, alchemy }
    }
    it('publishes only the initial Preview and keeps schema/ledger and activation gates separate', async () => {
        const { selected, input } = fixture()
        const result = await rehearseCloudflareDevelopment(selected, input)
        expect(result).toMatchObject({
            rehearsalVerified: true,
            activationVerified: false,
            migrationsExecuted: false,
            populatedRecoveryVerified: false,
        })
        expect(input.run).toHaveBeenCalledExactlyOnceWith(selected.deploy)
        expect(input.api.createInitialDevelopmentPreview).toHaveBeenCalledExactlyOnceWith()
        expect(input.api.preparePreview).not.toHaveBeenCalled()
        expect(input.api.setPreviewSecrets).toHaveBeenCalledExactlyOnceWith(
            'development',
            'version354',
            input.runtimeSecrets,
        )
        expect(input.verifyProduction).not.toHaveBeenCalled()
        expect(
            input.api.query.mock.calls.every(
                ([id, sql]) =>
                    id === inventory.development.database.id && sql.startsWith('SELECT '),
            ),
        ).toBe(true)
    })
    it('requires the separate receipt before any remote operation', async () => {
        const { selected, input } = fixture()
        await expect(
            rehearseCloudflareDevelopment(selected, { ...input, approval: activation() }),
        ).rejects.toThrow()
        expect(input.api.inspect).not.toHaveBeenCalled()
        await expect(
            publishCloudflareNative(selected, { ...input, activation: input.approval }),
        ).rejects.toThrow()
        expect(input.api.inspect).not.toHaveBeenCalled()
    })
    it('rejects production and PR plans before inspection', async () => {
        for (const mode of ['production', 'pr-354']) {
            const { input } = fixture()
            await expect(rehearseCloudflareDevelopment(plan(mode), input)).rejects.toThrow()
            expect(input.api.inspect).not.toHaveBeenCalled()
        }
    })
    it('never replaces an existing Preview during the initial rehearsal', async () => {
        const { selected, input } = fixture()
        const existing = await input.api.inspect()
        const api = {
            ...input.api,
            inspect: vi.fn(async () => ({
                ...existing,
                resources: {
                    ...existing.resources,
                    preview: { id: 'existing', name: 'development', slug: 'development' },
                },
            })),
        }
        await expect(rehearseCloudflareDevelopment(selected, { ...input, api })).rejects.toThrow(
            /existing/,
        )
        expect(input.run).not.toHaveBeenCalled()
        expect(input.api.preparePreview).not.toHaveBeenCalled()
    })
    it('rejects a newly introduced cf ledger without attempting repair', async () => {
        const { selected, input, schema } = fixture()
        schema.push({
            type: 'table',
            name: 'd1_migrations',
            tableName: 'd1_migrations',
            sql: 'CREATE TABLE d1_migrations (name TEXT)',
        })
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow()
        expect(input.api.preparePreview).not.toHaveBeenCalled()
        expect(input.run).not.toHaveBeenCalled()
    })
    it('stops if source changes before Preview creation', async () => {
        const { selected, input } = fixture()
        input.latestSourceSha.mockResolvedValueOnce(sha).mockResolvedValueOnce('b'.repeat(40))
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow()
        expect(input.api.preparePreview).not.toHaveBeenCalled()
        expect(input.run).not.toHaveBeenCalled()
    })
    it('fails on an abnormal deploy result without patching secrets', async () => {
        const { selected, input } = fixture()
        input.run.mockResolvedValue({ exitCode: 1, signal: null, output: undefined })
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow(/Publication/)
        expect(input.api.setPreviewSecrets).not.toHaveBeenCalled()
    })
    it('retains a failed secret-patch outcome without claiming verification or attempting cleanup', async () => {
        const { selected, input } = fixture()
        input.api.setPreviewSecrets.mockRejectedValue(new Error('Synthetic patch rejection'))
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow(
            /patch rejection/,
        )
        expect(input.run).toHaveBeenCalledExactlyOnceWith(selected.deploy)
        expect(input.api.previewDeployment).toHaveBeenCalledExactlyOnceWith(
            'development',
            'latest',
            true,
        )
        expect(input.api.query).toHaveBeenCalledTimes(4)
    })
    it('rejects changed schema after HTTP verification', async () => {
        const { selected, input, schema, alchemy } = fixture()
        let schemaReads = 0
        input.api.query.mockImplementation(async (_id, sql) => {
            if (sql.includes('sqlite_schema')) {
                const result = structuredClone(schema)
                if (schemaReads++ > 0) result[0]!.sql += '; -- concurrent schema change'
                return result
            }
            return structuredClone(alchemy)
        })
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow(/changed/)
        expect(input.run).toHaveBeenCalledExactlyOnceWith(selected.deploy)
    })
    it('stops before deploy when the created Preview identity changes', async () => {
        const { selected, input } = fixture()
        input.api.preview.mockResolvedValue({
            id: 'other',
            name: 'development',
            slug: 'development',
        })
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow(/changed/)
        expect(input.run).not.toHaveBeenCalled()
        expect(input.api.query).toHaveBeenCalledTimes(4)
    })
    it('stops before deploy when the new Preview already has a deployment', async () => {
        const { selected, input } = fixture()
        input.api.previewDeployment.mockResolvedValue({
            id: 'unexpected',
            preview_name: 'development',
            env: {},
        })
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow(/already/)
        expect(input.run).not.toHaveBeenCalled()
        expect(input.api.query).toHaveBeenCalledTimes(4)
    })
    it('refuses secret transfer when cf publishes a different Preview identity', async () => {
        const { selected, input } = fixture()
        const original = input.run.getMockImplementation()!
        input.run.mockImplementation(async (command) => {
            const result = await original(command)
            return {
                ...result,
                output: { ...(result.output as typeof deployment), preview_id: 'other' },
            }
        })
        await expect(rehearseCloudflareDevelopment(selected, input)).rejects.toThrow(
            /identity changed/,
        )
        expect(input.api.setPreviewSecrets).not.toHaveBeenCalled()
        expect(input.api.query).toHaveBeenCalledTimes(4)
    })
    it('preserves publication and postflight failures together', async () => {
        const { selected, input } = fixture()
        const primary = new Error('Synthetic publication failure')
        const postflight = new Error('Synthetic postflight failure')
        input.run.mockRejectedValue(primary)
        const query = input.api.query.getMockImplementation()!
        let reads = 0
        input.api.query.mockImplementation(async (...args) => {
            if (++reads > 2) throw postflight
            return query(...args)
        })
        const reportPostflight = vi.fn()
        const failure = await rehearseCloudflareDevelopment(selected, {
            ...input,
            reportPostflight,
        }).catch((error: unknown) => error)
        expect(failure).toBeInstanceOf(AggregateError)
        expect((failure as AggregateError).errors).toEqual([primary, postflight])
        expect(reportPostflight).toHaveBeenCalledExactlyOnceWith(false)
    })
    it('keeps HTTP failures fatal after publication', async () => {
        const { selected, input } = fixture()
        const httpFetch: typeof fetch = async () => new Response('unhealthy', { status: 500 })
        await expect(
            rehearseCloudflareDevelopment(selected, { ...input, httpFetch }),
        ).rejects.toThrow()
        expect(input.api.query).toHaveBeenCalledTimes(4)
    })
})

describe('inactive native publication execution path', () => {
    it.each(['development', 'pr-354'])('never transfers an OG secret for %s', (mode) => {
        const secrets = prepareCloudflareRuntimeSecrets(plan(mode), inventory, runtimeInput)
        expect(secrets).not.toHaveProperty('OG_IMAGE_SECRET')
        const value = output(mode)
        Object.assign(value.workers.default.config.env, { EMAIL: { type: 'send-email' } })
        expect(() =>
            validateCloudflareBuildOutput(value, { mode, isPreview: true, inventory }),
        ).toThrow()
    })
    it('keeps signing derivation canonical and excludes disabled PR OAuth', () => {
        const secrets = prepareCloudflareRuntimeSecrets(plan(), inventory, runtimeInput)
        expect(secrets.BETTER_AUTH_SECRET).toBe(runtimeInput.BETTER_AUTH_SECRET)
        expect(secrets.NUXT_BETTER_AUTH_SECRET).toBe(runtimeInput.BETTER_AUTH_SECRET)
        expect(secrets).not.toHaveProperty('TWITTER_CLIENT_SECRET')
        expect(() =>
            prepareCloudflareRuntimeSecrets(plan(), inventory, {
                ...runtimeInput,
                BETTER_AUTH_SECRET: 'short',
            }),
        ).toThrow()
    })
    it('runs reviewed resource inspection, fresh migration, deploy, secrets and version checks in order', async () => {
        const { selected, input, events } = nativeFixture()
        const result = await publishCloudflareNative(selected, input)
        expect(result).toMatchObject({
            sourceSha: sha,
            publicationVerified: true,
            deploymentId: 'version354',
        })
        expect(events.indexOf('apply')).toBeLessThan(events.indexOf('deploy'))
        expect(events.indexOf('secrets')).toBeGreaterThan(events.indexOf('deploy'))
        expect(events.indexOf('http')).toBeGreaterThan(events.indexOf('secrets'))
        expect(input.api.previewDeployment).toHaveBeenCalledWith('pr-354', 'version354')
        expect(input.verifyProduction).not.toHaveBeenCalled()
    })
    it('performs no remote calls when activation remains disabled', async () => {
        const { selected, input } = nativeFixture()
        await expect(
            publishCloudflareNative(selected, { ...input, enabled: false }),
        ).rejects.toThrow()
        expect(input.api.inspect).not.toHaveBeenCalled()
        expect(input.run).not.toHaveBeenCalled()
    })
    it('stops populated databases without a reconciled ledger before any migration', async () => {
        const { selected, input } = nativeFixture()
        input.api.query.mockResolvedValue([{ name: '__alchemy_migrations' }])
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/Populated/)
        expect(input.run).not.toHaveBeenCalled()
        expect(input.api.preparePreview).not.toHaveBeenCalled()
    })
    it('does not apply pending PR migrations to a shared Preview database', async () => {
        const { selected, input } = nativeFixture()
        selected.resources.ownership = 'shared-preview'
        input.api.query
            .mockResolvedValueOnce([{ name: 'd1_migrations' }])
            .mockResolvedValueOnce([{ name: names[0]! }])
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(
            /must not migrate shared/,
        )
        expect(input.run).not.toHaveBeenCalled()
        expect(input.api.preparePreview).not.toHaveBeenCalled()
    })
    it.each([
        { exitCode: 0, signal: 'SIGTERM', output: [] },
        { exitCode: 1, signal: null, output: [] },
    ])('never deploys after abnormal migration exit (%j)', async (result) => {
        const { selected, input } = nativeFixture()
        input.run.mockResolvedValue(result)
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/Migration/)
        expect(input.run).toHaveBeenCalledTimes(1)
        expect(input.api.setPreviewSecrets).not.toHaveBeenCalled()
    })
    it('does not deploy stale source after migrations finish', async () => {
        const { selected, input } = nativeFixture()
        input.latestSourceSha.mockResolvedValueOnce(sha).mockResolvedValueOnce('b'.repeat(40))
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/during migration/)
        expect(input.run).toHaveBeenCalledTimes(2)
    })
    it('rejects a post-deploy binding mismatch even when HTTP would pass', async () => {
        const { selected, input, events } = nativeFixture()
        const value = await input.api.previewDeployment(selected.mode, 'version354')
        if (!value) throw new Error('Synthetic deployment required')
        value.env.APP_DB = { type: 'd1', database_id: inventory.production.database.id }
        input.api.previewDeployment.mockResolvedValue(value)
        await expect(publishCloudflareNative(selected, input)).rejects.toThrow(/D1 identity/)
        expect(events).not.toContain('http')
    })
})

describe('complete native Build Output and reviewed resource assignment', () => {
    it.each(['production', 'development', 'pr-354', 'pr-355'])(
        'composes %s without provisioning or enabling delivery',
        (mode) => {
            const result = plan(mode)
            const target = mode.startsWith('pr-')
                ? inventory.previews![mode]!
                : inventory[mode === 'production' ? 'production' : 'development']
            expect(result.resources.database).toEqual(target.database)
            expect(result.resources.bucket.name).toBe(target.bucket)
            expect(result.buildEnvironment.PUBLIC_SITE_URL).toBe(target.siteUrl)
            expect(result.executionEnabled).toBe(false)
            expect(result.remoteMigrations).toBe(true)
            expect(result.apply.args).toEqual([
                'node_modules/cf/bin/cf',
                'd1',
                'migrations',
                'apply',
                target.database.id,
                '--dir',
                'drizzle',
                '--pattern',
                'drizzle/*/migration.sql',
                '--table',
                'd1_migrations',
            ])
            expect(result.deploy.args).toContain('--prebuilt')
            expect(result.deploy.args).not.toContain('--local')
            expect(result.deploy.args).not.toContain('--secrets-file')
            expect(result.deploy.args).not.toContain('--dry-run')
            expect(result.deploy.args.slice(1, 4)).toEqual(
                mode === 'production'
                    ? ['deploy', '--prebuilt', '--mode']
                    : ['previews', 'deploy', mode],
            )
            expect(plan(mode).resources).toEqual(result.resources)
        },
    )
    it('rejects a missing reviewed PR target rather than allocating or using development data', () => {
        expect(() =>
            createCloudflarePublishPlan({
                evidence: evidence('pr-356'),
                inventory,
                buildOutput: output('pr-354'),
                migrationNames: names,
            }),
        ).toThrow(/reviewed resource/)
    })
    it.each([
        (value: ReturnType<typeof output>) => {
            value.rootConfig.accountId = '1'.repeat(32)
        },
        (value: ReturnType<typeof output>) => {
            value.rootConfig.buildContext.isPreview = false
        },
        (value: ReturnType<typeof output>) => {
            value.rootConfig.buildContext.mode = 'production'
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.config.name = 'avatio-development'
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.config.env.APP_DB = createCloudflareConfig(
                { mode: 'production', isPreview: false },
                inventory,
            ).worker.env.APP_DB!
        },
        (value: ReturnType<typeof output>) => {
            delete value.workers.default.config.env.IMAGES
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.config.env.BETTER_AUTH_SECRET = {
                type: 'text',
                value: 'synthetic-secret-must-not-be-printed',
            }
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.config.env.UNREVIEWED = { type: 'text', value: 'extra' }
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.config.triggers = [{ type: 'scheduled', schedule: '* * * * *' }]
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.config.manifest.type = 'partial'
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.config.manifest.mainModule = '../index.js'
        },
        (value: ReturnType<typeof output>) => {
            value.workers.default.assetsDir = ''
        },
        (value: ReturnType<typeof output>) => {
            Object.assign(value.workers.default.config.assets, { runWorkerFirst: false })
        },
    ])('rejects a packaged contract/configuration mismatch without echoing values', (mutate) => {
        const value = output('pr-354')
        mutate(value)
        expect(() =>
            validateCloudflareBuildOutput(value, { mode: 'pr-354', isPreview: true, inventory }),
        ).toThrow()
        try {
            validateCloudflareBuildOutput(value, { mode: 'pr-354', isPreview: true, inventory })
        } catch (error) {
            expect(String(error)).not.toContain('synthetic-secret-must-not-be-printed')
        }
    })
    it('rejects additional Workers and assets-only output', () => {
        const value = output('pr-354')
        expect(() =>
            validateCloudflareBuildOutput(
                { ...value, workers: { ...value.workers, other: value.workers.default } },
                { mode: 'pr-354', isPreview: true, inventory },
            ),
        ).toThrow()
        expect(() =>
            validateCloudflareBuildOutput(
                {
                    ...value,
                    workers: { default: { ...value.workers.default, bundleDir: undefined } },
                },
                { mode: 'pr-354', isPreview: true, inventory },
            ),
        ).toThrow()
    })
    it.each(
        [[], [names[0]!, names[0]!], [...names].reverse(), ['old.sql']].map((migrationNames) => ({
            migrationNames,
        })),
    )('rejects ambiguous migration discovery %j', ({ migrationNames }) => {
        expect(() =>
            createCloudflarePublishPlan({
                evidence: evidence('pr-354'),
                inventory,
                buildOutput: output('pr-354'),
                migrationNames,
            }),
        ).toThrow(/filenames/)
    })
})

describe('remote migration result gating independent of local CLI behavior', () => {
    it('accepts successful receipts and exact full bookkeeping while keeping execution disabled', () => {
        expect(confirmCloudflarePublisherMigrations(plan(), receipt())).toEqual({
            migrationsVerified: true,
            executionEnabled: false,
        })
    })
    it.each([
        { accountId: '1'.repeat(32) },
        { databaseId: inventory.production.database.id },
        { apply: { exitCode: 0, signal: 'SIGTERM', output: [] } },
        { apply: { exitCode: 1, output: [] } },
        { apply: { exitCode: 0, output: undefined } },
        { apply: { exitCode: 0, output: [{ name: names[0], status: '❌' }] } },
        { apply: { exitCode: 0, output: [{ name: 'unknown', status: '✅' }] } },
        { pending: { exitCode: 0, output: [{ Name: names[1] }] } },
        { pending: { exitCode: 1, output: [] } },
        { appliedNames: [names[0]!] },
        { appliedNames: [names[0]!, names[0]!] },
        { appliedNames: [...names, 'unknown'] },
    ])('rejects wrong target, silent failure or incomplete migration evidence %j', (override) => {
        expect(() =>
            confirmCloudflarePublisherMigrations(plan(), { ...receipt(), ...override }),
        ).toThrow(/unverified/)
    })
    it('accepts an idempotent rerun only with complete post-command bookkeeping', () => {
        expect(
            confirmCloudflarePublisherMigrations(plan(), {
                ...receipt(),
                apply: { exitCode: 0, output: [] },
            }).migrationsVerified,
        ).toBe(true)
    })
})

describe('credentialless publisher sequencing simulation', () => {
    const inspected = () => ({
        complete: true,
        accountId: inventory.accountId,
        workerName: 'avatio',
        resources: {
            database: inventory.previews!['pr-354']!.database,
            cache: inventory.previews!['pr-354']!.cache,
            bucket: { name: inventory.previews!['pr-354']!.bucket },
        },
    })
    const fixture = (
        overrides: {
            migrationExit?: number
            latest?: string
            verify?: boolean
            deployed?: unknown
        } = {},
    ) => {
        const calls: string[][] = []
        const fake = {
            simulation: true as const,
            inspectedResources: async () => inspected(),
            run: async (command: ReturnType<typeof plan>['apply']) => {
                calls.push(command.args)
                if (command.args[3] === 'apply')
                    return {
                        exitCode: overrides.migrationExit ?? 0,
                        output: receipt().apply.output,
                    }
                if (command.args[3] === 'list') return { exitCode: 0, output: [] }
                return { exitCode: 0, output: overrides.deployed ?? deployment }
            },
            appliedNames: async () => [...names],
            latestSourceSha: async () => overrides.latest ?? sha,
            verifyVersion: async () => overrides.verify ?? true,
        }
        return { calls, fake }
    }
    it('orders explicit remote migration, pending check, latest SHA and exact Preview deployment', async () => {
        const { calls, fake } = fixture()
        const result = await simulateCloudflarePublication(plan(), fake)
        expect(calls.map((args) => args.slice(1, 4))).toEqual([
            ['d1', 'migrations', 'apply'],
            ['d1', 'migrations', 'list'],
            ['previews', 'deploy', 'pr-354'],
        ])
        expect(result).toEqual({
            simulationComplete: true,
            activationVerified: false,
            cloudflareOperations: 0,
        })
    })
    it('never prepares deployment after a migration failure', async () => {
        const { calls, fake } = fixture({ migrationExit: 1 })
        await expect(simulateCloudflarePublication(plan(), fake)).rejects.toThrow(/forbidden/)
        expect(calls).toHaveLength(1)
    })
    it('requires positive exact resource inspection before even simulating a migration', async () => {
        const { calls, fake } = fixture()
        await expect(
            simulateCloudflarePublication(plan(), {
                ...fake,
                inspectedResources: async () => ({ complete: false }),
            }),
        ).rejects.toThrow(/inspection/)
        expect(calls).toHaveLength(0)
        expect(() =>
            verifyCloudflarePublisherResources(plan(), {
                ...inspected(),
                resources: { ...inspected().resources, database: inventory.production.database },
            }),
        ).toThrow(/assignment/)
    })
    it('refuses stale source after migration', async () => {
        const { calls, fake } = fixture({ latest: 'b'.repeat(40) })
        await expect(simulateCloudflarePublication(plan(), fake)).rejects.toThrow(/superseded/)
        expect(calls).toHaveLength(2)
    })
    it('rejects wrong Preview output or failed version smoke without claiming activation', async () => {
        await expect(
            simulateCloudflarePublication(
                plan(),
                fixture({ deployed: { ...deployment, preview_name: 'development' } }).fake,
            ),
        ).rejects.toThrow()
        await expect(
            simulateCloudflarePublication(plan(), fixture({ verify: false }).fake),
        ).rejects.toThrow(/version verification/)
    })
})

describe('shared Preview publication identity', () => {
    it('classifies a normalized shared D1 as shared even when reviewed UUID input has uppercase letters', () => {
        const shared = createCloudflareResourceFixture()
        shared.sharedPreviewStorage.database.id = 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF'
        Object.assign(shared.previews!['pr-354']!, structuredClone(shared.sharedPreviewStorage))
        expect(plan('pr-354', shared).resources.ownership).toBe('shared-preview')
    })
})
