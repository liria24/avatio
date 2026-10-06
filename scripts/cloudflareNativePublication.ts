import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

import { createCloudflareConfig, type CloudflareResourceInventory } from '../config/cloudflare.ts'
import { requireCloudflareActivation } from '../config/cloudflareActivation.ts'
import {
    parseCloudflarePreviewDeployment,
    createCloudflarePreviewCleanupPlan,
    verifyCloudflarePreviewCleanup,
} from '../config/cloudflarePreviewLifecycle.ts'
import {
    confirmCloudflarePublisherMigrations,
    verifyCloudflarePublisherResources,
    type createCloudflarePublishPlan,
} from '../config/cloudflarePublisher.ts'
import { validateSecrets } from '../config/secrets.ts'
import {
    type createCloudflareNativeApi,
    verifyCloudflarePreviewBindings,
} from './cloudflareNativeApi.ts'
import { verifyCloudflarePreviewHttp } from './cloudflarePreviewSmoke.ts'

type Plan = ReturnType<typeof createCloudflarePublishPlan>
type Result = { exitCode: number | null; signal: string | null; output: unknown }

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
        const timer = setTimeout(() => child.kill(), 120_000)
        child.stdout.on('data', (chunk: Buffer) => {
            bytes += chunk.length
            if (bytes > 4_194_304) {
                overflow = true
                child.kill()
            } else stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk: Buffer) => {
            bytes += chunk.length
            if (bytes > 4_194_304) {
                overflow = true
                child.kill()
            }
        })
        child.on('error', () => {
            clearTimeout(timer)
            reject(new Error('Pinned cf command could not start.'))
        })
        child.on('close', (exitCode, signal) => {
            clearTimeout(timer)
            if (overflow) {
                reject(new Error('Pinned cf output exceeded its private capture limit.'))
                return
            }
            let output: unknown
            try {
                output = JSON.parse(stdout)
            } catch {
                const version = /^(?:Current|Worker) Version ID:\s*([a-f0-9-]{36})\s*$/m.exec(
                    stdout,
                )?.[1]
                output = version ? { type: 'production', versionId: version } : undefined
            }
            done({ exitCode, signal, output })
        })
    })

export const prepareCloudflareRuntimeSecrets = (
    plan: Plan,
    inventory: CloudflareResourceInventory,
    input: Record<string, string | undefined>,
) => {
    const env = createCloudflareConfig({ mode: plan.mode, isPreview: plan.isPreview }, inventory)
        .worker.env
    const required = Object.entries(env)
        .filter(([, binding]) => binding.type === 'secret')
        .map(([name]) => name)
    // The canonical validator remains authoritative; PRs deliberately omit Twitter.
    const validated = validateSecrets({
        ...input,
        ...(plan.mode.startsWith('pr-') ? { TWITTER_CLIENT_SECRET: 'disabled-pr' } : {}),
    })
    if (!validated.success)
        throw new Error('Canonical runtime secret validation failed; values are omitted.')
    return Object.fromEntries(
        required.map((name) => {
            const value =
                name === 'NUXT_BETTER_AUTH_SECRET'
                    ? validated.value.BETTER_AUTH_SECRET
                    : validated.value[name as keyof typeof validated.value]
            if (!value) throw new Error('A declared runtime secret is missing.')
            return [name, value]
        }),
    )
}

/** App-specific sequence. A failed migration never falls through to deploy or DB rollback. */
export const publishCloudflareNative = async (
    plan: Plan,
    input: {
        inventory: CloudflareResourceInventory
        activation: unknown
        enabled: boolean
        trustedCodeSha: string
        runtimeSecrets: Record<string, string>
        api: ReturnType<typeof createCloudflareNativeApi>
        run: (command: Plan['apply']) => Promise<Result>
        latestSourceSha: () => Promise<string>
        verifyProduction: (result: unknown) => Promise<void>
        httpFetch?: typeof fetch
    },
) => {
    requireCloudflareActivation(input.activation, {
        action: 'deploy',
        mode: plan.mode,
        sourceSha: plan.sourceSha,
        trustedCodeSha: input.trustedCodeSha,
        inventory: input.inventory,
        enabled: input.enabled,
    })
    if ((await input.latestSourceSha()) !== plan.sourceSha)
        throw new Error('Source changed before migration.')
    const inspected = await input.api.inspect(plan.mode, input.inventory)
    const { preview: _preview, ...resources } = inspected.resources
    verifyCloudflarePublisherResources(plan, { ...inspected, resources })
    // Existing/populated databases require the separately rehearsed ledger translation first.
    // Never create a ledger or import guessed applied names in the publisher.
    const tables = await input.api.query(
        plan.resources.database.id,
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    const hasLedger = tables.some((row) => (row as { name?: unknown }).name === 'd1_migrations')
    if (!hasLedger && tables.length > 0)
        throw new Error('Populated D1 has no reconciled cf ledger; stop for a copy rehearsal.')
    const before = hasLedger
        ? await input.api.query(
              plan.resources.database.id,
              'SELECT name FROM d1_migrations ORDER BY id',
          )
        : []
    const beforeNames = before.map((row) => String((row as { name?: unknown }).name))
    if (
        new Set(beforeNames).size !== beforeNames.length ||
        beforeNames.some((name, index) => name !== plan.migrationNames[index])
    )
        throw new Error('Remote ledger is not a committed migration prefix.')
    let previousDeploymentId: string | undefined
    if (plan.isPreview) {
        const existing = inspected.resources.preview
        if (existing) {
            const latest = await input.api.previewDeployment(plan.mode, 'latest', true)
            if (latest) {
                const expected = createCloudflareConfig(
                    { mode: plan.mode, isPreview: true },
                    input.inventory,
                ).worker.env
                if (Object.keys(latest.env).some((name) => !(name in expected)))
                    throw new Error('Existing Preview contains unreviewed inherited bindings.')
                for (const name of ['APP_DB', 'CONTENT_CACHE', 'R2']) {
                    const value = latest.env[name]
                    if (!value || typeof value !== 'object')
                        throw new Error('Existing Preview data identity is unavailable.')
                    const actual = value as Record<string, unknown>
                    if (
                        (name === 'APP_DB' && actual.database_id !== plan.resources.database.id) ||
                        (name === 'CONTENT_CACHE' &&
                            actual.namespace_id !== plan.resources.cache.id) ||
                        (name === 'R2' && actual.bucket_name !== plan.resources.bucket.name)
                    )
                        throw new Error('Existing Preview uses different data resources.')
                }
                if (typeof latest.id !== 'string' || !/^[\w-]+$/.test(latest.id))
                    throw new Error('Exact previous Preview version required.')
                previousDeploymentId = latest.id
            }
        }
        await input.api.preparePreview(plan.mode)
    }
    const apply = await input.run(plan.apply)
    if (apply.exitCode !== 0 || apply.signal)
        throw new Error('Migration did not exit normally; inspect D1 before retry.')
    const pending = await input.run(plan.pending)
    const rows = await input.api.query(
        plan.resources.database.id,
        'SELECT name FROM d1_migrations ORDER BY id',
    )
    confirmCloudflarePublisherMigrations(plan, {
        accountId: plan.resources.accountId,
        databaseId: plan.resources.database.id,
        apply,
        pending,
        appliedNames: rows.map((row) => String((row as { name?: unknown }).name)),
    })
    if ((await input.latestSourceSha()) !== plan.sourceSha)
        throw new Error('Source changed during migration; do not deploy.')
    if (previousDeploymentId)
        await input.api.setPreviewSecrets(plan.mode, previousDeploymentId, input.runtimeSecrets)
    const result = await input.run(plan.deploy)
    if (result.exitCode !== 0 || result.signal)
        throw new Error('Publication did not exit normally; inspect the current version.')
    if (plan.isPreview) {
        const deployment = parseCloudflarePreviewDeployment(result.output, {
            mode: plan.mode,
            siteUrl: plan.buildEnvironment.PUBLIC_SITE_URL,
        })
        await input.api.setPreviewSecrets(plan.mode, deployment.deploymentId, input.runtimeSecrets)
        verifyCloudflarePreviewBindings(
            await input.api.previewDeployment(plan.mode, deployment.deploymentId),
            createCloudflareConfig({ mode: plan.mode, isPreview: true }, input.inventory).worker
                .env,
            deployment,
        )
        await verifyCloudflarePreviewHttp(
            result.output,
            {
                mode: plan.mode,
                siteUrl: plan.buildEnvironment.PUBLIC_SITE_URL,
            },
            input.httpFetch,
        )
        return { ...deployment, sourceSha: plan.sourceSha, publicationVerified: true as const }
    }
    await input.verifyProduction(result.output)
    return { mode: plan.mode, sourceSha: plan.sourceSha, publicationVerified: true as const }
}

/** Serial Actions concurrency must cover this whole close/reopen sequence. */
export const cleanupCloudflareNativePr = async (input: {
    inventory: CloudflareResourceInventory
    activation: unknown
    enabled: boolean
    trustedCode: Parameters<typeof createCloudflarePreviewCleanupPlan>[0]['trustedCode']
    trustedRef: string
    trustedSha: string
    readPr: () => Promise<unknown>
    api: ReturnType<typeof createCloudflareNativeApi>
    mode: string
}) => {
    requireCloudflareActivation(input.activation, {
        action: 'cleanup',
        mode: input.mode,
        sourceSha: input.trustedSha,
        trustedCodeSha: input.trustedSha,
        inventory: input.inventory,
        enabled: input.enabled,
    })
    const pr = await input.readPr()
    const plan = createCloudflarePreviewCleanupPlan({
        ...input,
        pr,
        inspection: await input.api.inspect(input.mode, input.inventory),
    })
    if (plan.mode !== input.mode) throw new Error('Cleanup target differs from fresh PR state.')
    const checkClosed = async () =>
        createCloudflarePreviewCleanupPlan({
            ...input,
            pr: await input.readPr(),
            inspection: await input.api.inspect(input.mode, input.inventory),
        })
    await checkClosed()
    if (plan.resources.preview) await input.api.deletePreview(input.mode, plan.resources.preview.id)
    for (const kind of ['database', 'cache', 'bucket'] as const) {
        await checkClosed()
        await input.api.deletePrResource(input.mode, kind, input.inventory)
    }
    return verifyCloudflarePreviewCleanup(
        plan,
        await input.readPr(),
        await input.api.inspect(input.mode, input.inventory),
    )
}
