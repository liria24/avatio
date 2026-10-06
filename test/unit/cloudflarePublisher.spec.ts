import { resolve } from 'node:path'

import { createCloudflareConfig } from '../../config/cloudflare'
import { validateCloudflareBuildOutput } from '../../config/cloudflareBuildOutput'
import type { CloudflareDeliveryEvidence } from '../../config/cloudflareDelivery'
import {
    confirmCloudflarePublisherMigrations,
    createCloudflarePublishPlan,
    simulateCloudflarePublication,
    verifyCloudflarePublisherResources,
} from '../../config/cloudflarePublisher'
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
const output = (mode: string) => {
    const config = createCloudflareConfig({ mode, isPreview: mode !== 'production' }, inventory)
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
const plan = (mode = 'pr-354') =>
    createCloudflarePublishPlan({
        evidence: evidence(mode),
        inventory,
        buildOutput: output(mode),
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
                './drizzle',
                '--pattern',
                '*/migration.sql',
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
