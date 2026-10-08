import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

import {
    createCloudflareConfig,
    getCloudflareTargetResources,
    type CloudflareResourceInventory,
} from '../config/cloudflare.ts'
import {
    parseCloudflarePreviewDeployment,
    createCloudflarePreviewCleanupPlan,
    verifyCloudflarePreviewCleanup,
} from '../config/cloudflarePreviewLifecycle.ts'
import {
    confirmCloudflarePublisherMigrations,
    createCloudflareMigrationCommands,
    verifyCloudflarePublisherResources,
    type createCloudflarePublishPlan,
} from '../config/cloudflarePublisher.ts'
import {
    type createCloudflareNativeApi,
    verifyCloudflarePreviewBindings,
} from './cloudflareNativeApi.ts'
import { nativePhase, type NativeReporter } from './cloudflareNativeDiagnostics.ts'
import { verifyCloudflareDeploymentHttp } from './cloudflarePreviewSmoke.ts'

type Plan = ReturnType<typeof createCloudflarePublishPlan>
type Result = { exitCode: number | null; signal: string | null; output: unknown }

/** Publish once using cf's normal Previews Base inheritance; transfer no runtime secrets. */
export const publishCloudflarePreviewArtifact = async (
    plan: Plan,
    input: {
        inventory: CloudflareResourceInventory
        api: ReturnType<typeof createCloudflareNativeApi>
        run: (command: Plan['apply']) => Promise<Result>
        httpFetch?: typeof fetch
        expectedPreviewId?: string
        reportDiagnostic?: NativeReporter
        reportPublication?: (receipt: {
            sourceSha: string
            previewId: string
            deploymentId: string
            deploymentUrl: string
            stage: 'cli-receipt' | 'bindings-verified' | 'http-verified'
        }) => void
    },
) => {
    if (!plan.isPreview || plan.mode === 'production')
        throw new Error('Production cutover remains on hold.')
    const phase = <T>(name: Parameters<typeof nativePhase>[0], operation: () => Promise<T> | T) =>
        nativePhase(name, input.reportDiagnostic, operation)
    const result = await phase('preview-publish', async () => {
        const result = await input.run(plan.deploy)
        input.reportDiagnostic?.({
            phase: 'preview-publish',
            outcome: 'started',
            evidence: {
                cliExitedNormally: result.exitCode === 0 && !result.signal,
                cliJsonAvailable: result.output !== undefined,
            },
        })
        if (result.exitCode !== 0 || result.signal)
            throw new Error('Publication did not exit normally; inspect the current version.')
        return result
    })
    const deployment = await phase('cli-receipt', () =>
        parseCloudflarePreviewDeployment(result.output, {
            mode: plan.mode,
            siteUrl: plan.buildEnvironment.PUBLIC_SITE_URL,
        }),
    )
    const report = (stage: 'cli-receipt' | 'bindings-verified' | 'http-verified') =>
        input.reportPublication?.({
            sourceSha: plan.sourceSha,
            previewId: deployment.previewId,
            deploymentId: deployment.deploymentId,
            deploymentUrl: deployment.deploymentUrl,
            stage,
        })
    // Retain actual CLI identity even if later inspection fails. This is not a success claim.
    report('cli-receipt')
    await phase('preview-parent', async () => {
        const parent = await input.api.preview(plan.mode)
        if (
            (input.expectedPreviewId && deployment.previewId !== input.expectedPreviewId) ||
            parent?.id !== deployment.previewId
        )
            throw new Error('Published Preview identity changed.')
    })
    const fresh = await phase('deployment-read', () =>
        input.api.previewDeployment(
            plan.mode,
            deployment.deploymentId,
            false,
            deployment.previewId,
        ),
    )
    await phase('binding-verification', () => {
        if (
            !fresh ||
            fresh.id !== deployment.deploymentId ||
            fresh.preview_id !== deployment.previewId ||
            fresh.preview_name !== plan.mode ||
            !Array.isArray(fresh.urls) ||
            !fresh.urls.includes(deployment.deploymentUrl) ||
            (fresh.sourceSha !== undefined && fresh.sourceSha !== plan.sourceSha)
        )
            throw new Error('Exact published deployment identity, URL or source differs.')
        verifyCloudflarePreviewBindings(
            fresh,
            createCloudflareConfig({ mode: plan.mode, isPreview: true }, input.inventory).worker
                .env,
            deployment,
        )
    })
    report('bindings-verified')
    await phase('immutable-http', () =>
        verifyCloudflareDeploymentHttp(deployment.deploymentUrl, input.httpFetch),
    )
    await phase('deployment-read', async () => {
        const latest = await input.api.previewDeployment(
            plan.mode,
            'latest',
            false,
            deployment.previewId,
        )
        if (latest?.id !== deployment.deploymentId)
            throw new Error('Published version is no longer latest.')
    })
    report('http-verified')
    return { ...deployment, sourceSha: plan.sourceSha, publicationVerified: true as const }
}

/** Base inheritance is not an allowlist: reject unreviewed inherited settings before publishing. */
export const verifyCloudflarePreviewBase = (
    input: unknown,
    inventory: CloudflareResourceInventory,
) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('Preview Base is unavailable.')
    const env = input as Record<string, unknown>
    const expected = createCloudflareConfig(
        { mode: 'pr-1', isPreview: true },
        { ...inventory, previews: {} },
    ).worker.env
    const auth = ['NUXT_BETTER_AUTH_SECRET']
    for (const name of auth) {
        const binding = env[name] as { type?: unknown } | undefined
        if (binding?.type !== 'secret_text')
            throw new Error('Preconfigured Base auth secret types are required.')
    }
    for (const [name, value] of Object.entries(env)) {
        if (
            !Object.hasOwn(expected, name) ||
            ['PREVIEW_NAME', 'SELF_URL', 'PUBLIC_SITE_URL', 'AUTH_TRUSTED_ORIGINS'].includes(name)
        )
            throw new Error('Preview Base contains unreviewed inherited bindings.')
        if (auth.includes(name)) continue
        // Every supplied non-secret Base binding must match the shared non-production contract.
        verifyCloudflarePreviewBindings(
            { id: 'base', preview_name: 'pr-1', env: { [name]: value } },
            { [name]: expected[name]! },
            { mode: 'pr-1', deploymentId: 'base' },
        )
    }
    return { baseVerified: true as const }
}

/** No shell, no raw CLI logging, bounded execution, no credentials supplied to application code. */
export const runCloudflareNativeCommand = (
    command: Plan['apply'],
    directory: string,
    env: Record<string, string>,
) =>
    new Promise<Result>((done, reject) => {
        const args = [...command.args]
        args[0] = resolve('node_modules/cf/bin/cf')
        const child = spawn(process.execPath, args, {
            cwd: directory,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        })
        let stdout = ''
        let bytes = 0
        let overflow = false
        let timedOut = false
        const timer = setTimeout(() => {
            timedOut = true
            child.kill('SIGKILL')
        }, 120_000)
        child.stdout.on('data', (chunk: Buffer) => {
            bytes += chunk.length
            if (bytes > 4_194_304) {
                overflow = true
                child.kill('SIGKILL')
            } else stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk: Buffer) => {
            bytes += chunk.length
            if (bytes > 4_194_304) {
                overflow = true
                child.kill('SIGKILL')
            }
        })
        child.on('error', () => {
            clearTimeout(timer)
            reject(new Error('Pinned cf command could not start.'))
        })
        child.on('close', (exitCode, signal) => {
            clearTimeout(timer)
            if (timedOut) {
                reject(new Error('Pinned cf command exceeded its execution deadline.'))
                return
            }
            if (overflow) {
                reject(new Error('Pinned cf output exceeded its private capture limit.'))
                return
            }
            let output: unknown
            try {
                output = JSON.parse(stdout)
            } catch {
                output = undefined
            }
            done({ exitCode, signal, output })
        })
    })

/** Shared schema changes are owner/manual trusted-base work, serialized with all Preview delivery. */
export const migrateCloudflareSharedPreview = async (input: {
    inventory: CloudflareResourceInventory
    manualDevelopmentApproved: boolean
    sourceSha: string
    migrationNames: readonly string[]
    api: ReturnType<typeof createCloudflareNativeApi>
    run: (command: Plan['apply']) => Promise<Result>
    latestSourceSha: () => Promise<string>
    reportDiagnostic?: NativeReporter
}) => {
    if (!input.manualDevelopmentApproved || !/^[a-f0-9]{40}$/.test(input.sourceSha))
        throw new Error(
            'Shared migrations require owner approval and current trusted development source.',
        )
    createCloudflareConfig({ mode: 'development', isPreview: true }, input.inventory)
    const sharedInventory = { ...input.inventory, previews: {} }
    const target = getCloudflareTargetResources('pr-1', sharedInventory)
    const plan = {
        workerName: 'avatio' as const,
        migrationNames: [...input.migrationNames],
        resources: {
            accountId: input.inventory.accountId,
            database: target.database,
            cache: target.cache,
            bucket: { name: target.bucket },
            ownership: 'shared-preview' as const,
        },
    }
    if (
        !plan.migrationNames.length ||
        new Set(plan.migrationNames).size !== plan.migrationNames.length ||
        plan.migrationNames.some(
            (name, index) =>
                !/^\d{14}_[\w-]+\/migration\.sql$/.test(name) ||
                (index > 0 && name <= plan.migrationNames[index - 1]!),
        )
    )
        throw new Error('Ordered immutable trusted-base migrations are required.')
    if ((await input.latestSourceSha()) !== input.sourceSha)
        throw new Error('Shared migration source changed.')
    const inspected = await nativePhase('resource-inspection', input.reportDiagnostic, () =>
        input.api.inspect('pr-1', sharedInventory),
    )
    const { preview: _preview, ...resources } = inspected.resources
    verifyCloudflarePublisherResources(plan, { ...inspected, resources })
    await nativePhase('migration-ledger', input.reportDiagnostic, async () => {
        const tables = await input.api.query(
            target.database.id,
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
        )
        const hasLedger = tables.some((row) => (row as { name?: unknown }).name === 'd1_migrations')
        if (!hasLedger && tables.length)
            throw new Error('Populated shared D1 requires reconciled migration history.')
        const before = hasLedger
            ? (
                  await input.api.query(
                      target.database.id,
                      'SELECT name FROM d1_migrations ORDER BY id',
                  )
              ).map((row) => String((row as { name?: unknown }).name))
            : []
        if (
            new Set(before).size !== before.length ||
            before.some((name, index) => name !== plan.migrationNames[index])
        )
            throw new Error('Shared D1 ledger differs from the immutable trusted-base prefix.')
    })
    if ((await input.latestSourceSha()) !== input.sourceSha)
        throw new Error('Shared migration source changed before apply.')
    const commands = createCloudflareMigrationCommands(target.database.id)
    const apply = await nativePhase('migration-apply', input.reportDiagnostic, async () => {
        const result = await input.run(commands.apply)
        if (result.exitCode !== 0 || result.signal)
            throw new Error('Shared migration did not exit normally; stop for inspection.')
        return result
    })
    await nativePhase('migration-postflight', input.reportDiagnostic, async () => {
        const pending = await input.run(commands.pending)
        const rows = await input.api.query(
            target.database.id,
            'SELECT name FROM d1_migrations ORDER BY id',
        )
        confirmCloudflarePublisherMigrations(plan, {
            accountId: input.inventory.accountId,
            databaseId: target.database.id,
            apply,
            pending,
            appliedNames: rows.map((row) => String((row as { name?: unknown }).name)),
        })
        if ((await input.latestSourceSha()) !== input.sourceSha)
            throw new Error('Shared migration source changed during execution.')
    })
    return {
        sharedMigrationsVerified: true as const,
        sourceSha: input.sourceSha,
        publicationPerformed: false as const,
    }
}

/** Serialized by Actions. Shared PRs never apply migrations, including no-op commands. */
export const publishCloudflareNative = async (
    plan: Plan,
    input: {
        inventory: CloudflareResourceInventory
        enabled: boolean
        manualDevelopmentApproved: boolean
        sharedMigrationsCompatible: boolean
        api: ReturnType<typeof createCloudflareNativeApi>
        run: (command: Plan['apply']) => Promise<Result>
        latestSourceSha: () => Promise<string>
        httpFetch?: typeof fetch
        reportDiagnostic?: NativeReporter
        reportPublication?: Parameters<
            typeof publishCloudflarePreviewArtifact
        >[1]['reportPublication']
    },
) => {
    if (!plan.isPreview || plan.mode === 'production')
        throw new Error('Production cutover remains on hold.')
    if (!input.enabled && !(plan.mode === 'development' && input.manualDevelopmentApproved))
        throw new Error('Native automatic delivery remains disabled.')
    if (plan.resources.ownership === 'shared-preview' && !input.sharedMigrationsCompatible)
        throw new Error('Shared PR migrations differ from the trusted base.')
    if ((await input.latestSourceSha()) !== plan.sourceSha)
        throw new Error('Source changed before publication.')
    await nativePhase('preview-base', input.reportDiagnostic, async () =>
        verifyCloudflarePreviewBase(await input.api.previewBaseBindings(), input.inventory),
    )
    const inspected = await nativePhase('resource-inspection', input.reportDiagnostic, () =>
        input.api.inspect(plan.mode, input.inventory),
    )
    const { preview, ...resources } = inspected.resources
    verifyCloudflarePublisherResources(plan, { ...inspected, resources })
    if (preview)
        await nativePhase('existing-preview', input.reportDiagnostic, async () => {
            const latest = await input.api.previewDeployment(plan.mode, 'latest', true, preview.id)
            // Existing missing/incompatible secrets require owner one-time initialization; no repair loop.
            if (latest) {
                const expected = createCloudflareConfig(
                    { mode: plan.mode, isPreview: true },
                    input.inventory,
                ).worker.env
                if (Object.keys(latest.env).some((name) => !Object.hasOwn(expected, name)))
                    throw new Error('Existing Preview has unreviewed inherited bindings.')
                // Fixed data/integration identities and secrets must already be safe. Other declared
                // non-secret settings may evolve; the NEW deployment still gets a full exact check.
                const critical = Object.fromEntries(
                    Object.entries(expected).filter(
                        ([name, binding]) =>
                            binding.type !== 'text' ||
                            [
                                'STAGE',
                                'PREVIEW_NAME',
                                'PUBLIC_SITE_URL',
                                'SELF_URL',
                                'AUTH_TRUSTED_ORIGINS',
                                'R2_PUBLIC_BASE_URL',
                            ].includes(name),
                    ),
                )
                const observed = Object.fromEntries(
                    Object.entries(latest.env).filter(([name]) => Object.hasOwn(critical, name)),
                )
                verifyCloudflarePreviewBindings({ ...latest, env: observed }, critical, {
                    mode: plan.mode,
                    deploymentId: latest.id,
                })
            }
        })
    const names = async () =>
        (
            await input.api.query(
                plan.resources.database.id,
                'SELECT name FROM d1_migrations ORDER BY id',
            )
        ).map((row) => String((row as { name?: unknown }).name))
    const before = await nativePhase('migration-ledger', input.reportDiagnostic, async () => {
        const tables = await input.api.query(
            plan.resources.database.id,
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
        )
        const hasLedger = tables.some((row) => (row as { name?: unknown }).name === 'd1_migrations')
        if (!hasLedger && tables.length)
            throw new Error('Populated D1 has no reconciled cf ledger; stop for a copy rehearsal.')
        const before = hasLedger ? await names() : []
        if (
            new Set(before).size !== before.length ||
            before.some((name, index) => name !== plan.migrationNames[index])
        )
            throw new Error('Remote ledger is not a committed migration prefix.')
        return before
    })
    if (plan.resources.ownership === 'shared-preview') {
        if (JSON.stringify(before) !== JSON.stringify(plan.migrationNames))
            throw new Error('Shared PR D1 requires already-applied trusted base migrations.')
    } else {
        const apply = await nativePhase('migration-apply', input.reportDiagnostic, async () => {
            const result = await input.run(plan.apply)
            if (result.exitCode !== 0 || result.signal)
                throw new Error('Migration did not exit normally; inspect D1 before retry.')
            return result
        })
        await nativePhase('migration-postflight', input.reportDiagnostic, async () => {
            const pending = await input.run(plan.pending)
            confirmCloudflarePublisherMigrations(plan, {
                accountId: plan.resources.accountId,
                databaseId: plan.resources.database.id,
                apply,
                pending,
                appliedNames: await names(),
            })
        })
    }
    if ((await input.latestSourceSha()) !== plan.sourceSha)
        throw new Error('Source changed during migration; do not deploy.')
    const result = await publishCloudflarePreviewArtifact(plan, {
        ...input,
        expectedPreviewId: preview?.id,
    })
    await nativePhase('publication-postflight', input.reportDiagnostic, async () => {
        if (
            JSON.stringify(await names()) !== JSON.stringify(plan.migrationNames) ||
            (await input.latestSourceSha()) !== plan.sourceSha
        )
            throw new Error('Source or migration ledger changed during publication.')
    })
    return result
}

/** Serial Actions concurrency must cover this whole close/reopen sequence. */
export const cleanupCloudflareNativePr = async (input: {
    inventory: CloudflareResourceInventory
    enabled: boolean
    trustedCode: Parameters<typeof createCloudflarePreviewCleanupPlan>[0]['trustedCode']
    trustedRef: string
    trustedSha: string
    readPr: () => Promise<unknown>
    api: ReturnType<typeof createCloudflareNativeApi>
    mode: string
}) => {
    if (!input.enabled) throw new Error('Native automatic cleanup remains disabled.')
    const pr = await input.readPr()
    const plan = createCloudflarePreviewCleanupPlan({
        ...input,
        pr,
        inspection: await input.api.inspect(input.mode, input.inventory),
    })
    if (plan.mode !== input.mode) throw new Error('Cleanup target differs from fresh PR state.')
    const checkClosed = async () => {
        const fresh = createCloudflarePreviewCleanupPlan({
            ...input,
            pr: await input.readPr(),
            inspection: await input.api.inspect(input.mode, input.inventory),
        })
        if (fresh.mode !== plan.mode) throw new Error('PR identity changed before cleanup.')
        return fresh
    }
    await checkClosed()
    if (plan.resources.preview) await input.api.deletePreview(input.mode, plan.resources.preview.id)
    return verifyCloudflarePreviewCleanup(
        plan,
        await input.readPr(),
        await input.api.inspect(input.mode, input.inventory),
    )
}
