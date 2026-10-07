import { z } from 'zod'

import type { CloudflareResourceInventory } from './cloudflare.ts'
import { validateCloudflareBuildOutput } from './cloudflareBuildOutput.ts'
import {
    validateCloudflareDeliveryEvidence,
    type CloudflareDeliveryEvidence,
} from './cloudflareDelivery.ts'
import { parseCloudflarePreviewDeployment } from './cloudflarePreviewLifecycle.ts'
import { getStageConfig } from './environment.ts'

interface CommandResult {
    exitCode: number | null
    signal?: string | null
    output: unknown
}

const inspectionSchema = z.strictObject({
    complete: z.literal(true),
    accountId: z.string(),
    workerName: z.literal('avatio'),
    resources: z.strictObject({
        database: z.strictObject({ id: z.string(), name: z.string() }),
        cache: z.strictObject({ id: z.string(), name: z.string() }),
        bucket: z.strictObject({ name: z.string() }),
    }),
})

/** Exact pinned public CLI calls. This plan never runs commands or enables a publisher. */
export const createCloudflarePublishPlan = (input: {
    evidence: CloudflareDeliveryEvidence
    inventory: unknown
    buildOutput: unknown
    migrationNames: readonly string[]
}) => {
    const target = validateCloudflareDeliveryEvidence(input.evidence)
    const { configuration } = validateCloudflareBuildOutput(input.buildOutput, {
        ...target,
        inventory: input.inventory,
    })
    const names = [...input.migrationNames]
    if (
        !names.length ||
        new Set(names).size !== names.length ||
        names.some((name) => !/^\d{14}_[\w-]+\/migration\.sql$/.test(name)) ||
        names.some((name, index) => index > 0 && name <= names[index - 1]!)
    )
        throw new Error('The exact ordered committed migration filenames are required.')
    const env = configuration.worker.env
    const database = env.APP_DB
    const cache = env.CONTENT_CACHE
    const bucket = env.R2
    const site = env.PUBLIC_SITE_URL
    const images = env.R2_PUBLIC_BASE_URL
    if (
        database?.type !== 'd1' ||
        !database.id ||
        !database.name ||
        cache?.type !== 'kv' ||
        !cache.id ||
        bucket?.type !== 'r2' ||
        !bucket.name ||
        site?.type !== 'text' ||
        images?.type !== 'text'
    )
        throw new Error(
            'Explicit reviewed resource identities and public build settings are required.',
        )
    const command = (args: string[]) => ({
        executable: 'node' as const,
        args: ['node_modules/cf/bin/cf', ...args],
    })
    const migrations = (action: 'apply' | 'list') =>
        command([
            'd1',
            'migrations',
            action,
            database.id!,
            '--dir',
            'drizzle',
            '--pattern',
            'drizzle/*/migration.sql',
            '--table',
            'd1_migrations',
        ])
    return {
        ...target,
        sourceSha: input.evidence.sourceSha,
        // Selection reuses reviewed identities. It never provisions permanent or ephemeral resources.
        resources: {
            accountId: configuration.accountId,
            database: { id: database.id, name: database.name },
            cache: {
                id: cache.id,
                name: target.mode.startsWith('pr-')
                    ? `avatio-${target.mode}`
                    : getStageConfig(target.isPreview ? 'development' : 'production').infrastructure
                          .cache,
            },
            bucket: { name: bucket.name },
            ownership: target.mode.startsWith('pr-')
                ? database.id ===
                  (
                      input.inventory as CloudflareResourceInventory
                  ).sharedPreviewStorage.database.id.toLowerCase()
                    ? ('shared-preview' as const)
                    : ('dedicated-pr' as const)
                : ('existing' as const),
        },
        buildEnvironment: {
            STAGE: target.isPreview ? 'development' : 'production',
            PREVIEW_NAME: target.isPreview ? target.mode : '',
            PUBLIC_SITE_URL: site.value,
            R2_PUBLIC_BASE_URL: images.value,
        },
        commandEnvironment: {
            CLOUDFLARE_ACCOUNT_ID: configuration.accountId,
            CF_SEND_TELEMETRY: 'false',
        },
        // apply defaults to remote in this pinned CLI; never add --local or use a database name.
        remoteMigrations: true as const,
        migrationNames: names,
        apply: migrations('apply'),
        pending: migrations('list'),
        deploy: command(
            target.isPreview
                ? [
                      'previews',
                      'deploy',
                      target.mode,
                      '--prebuilt',
                      '--mode',
                      target.mode,
                      '--worker',
                      'avatio',
                  ]
                : ['deploy', '--prebuilt', '--mode', 'production', '--worker', 'avatio'],
        ),
        requiredRemoteProofs: [
            'reviewed-account-and-binding-inspection',
            'classified-data-recovery-and-migration-history',
            target.isPreview
                ? 'preview-scoped-runtime-secrets'
                : 'production-runtime-secrets-and-recovery-point',
            'single-publisher-and-serialized-migration-deploy',
            'specific-deployed-version-bindings-and-http',
        ],
        executionEnabled: false as const,
    }
}

/** Reject silent abort/failure and incomplete bookkeeping before preparing a deploy step. */
export const confirmCloudflarePublisherMigrations = (
    plan: ReturnType<typeof createCloudflarePublishPlan>,
    evidence: {
        accountId: string
        databaseId: string
        apply: CommandResult
        pending: CommandResult
        appliedNames: readonly string[]
    },
) => {
    if (
        evidence.accountId !== plan.resources.accountId ||
        evidence.databaseId !== plan.resources.database.id ||
        [evidence.apply, evidence.pending].some(
            (result) => result.exitCode !== 0 || result.signal,
        ) ||
        !Array.isArray(evidence.apply.output) ||
        evidence.apply.output.some(
            (row: unknown) =>
                !row ||
                typeof row !== 'object' ||
                !('name' in row) ||
                !plan.migrationNames.includes(String(row.name)) ||
                !('status' in row) ||
                row.status !== '✅',
        ) ||
        !Array.isArray(evidence.pending.output) ||
        evidence.pending.output.length !== 0 ||
        new Set(evidence.appliedNames).size !== plan.migrationNames.length ||
        evidence.appliedNames.length !== plan.migrationNames.length ||
        plan.migrationNames.some((name) => !evidence.appliedNames.includes(name))
    )
        throw new Error(
            'Remote migration completion is unverified; do not deploy or infer rollback.',
        )
    return { migrationsVerified: true as const, executionEnabled: false as const }
}

/** A fresh positive inspection, never treating a denied read as a missing resource to create. */
export const verifyCloudflarePublisherResources = (
    plan: ReturnType<typeof createCloudflarePublishPlan>,
    input: unknown,
) => {
    const parsed = inspectionSchema.safeParse(input)
    if (!parsed.success) throw new Error('Complete successful target inspection is required.')
    const actual = parsed.data
    if (
        actual.accountId !== plan.resources.accountId ||
        actual.workerName !== plan.workerName ||
        actual.resources.database.id !== plan.resources.database.id ||
        actual.resources.database.name !== plan.resources.database.name ||
        actual.resources.cache.id !== plan.resources.cache.id ||
        actual.resources.cache.name !== plan.resources.cache.name ||
        actual.resources.bucket.name !== plan.resources.bucket.name
    )
        throw new Error('Observed resource assignment differs from the reviewed target.')
    return { resourcesVerified: true as const, executionEnabled: false as const }
}

/** A credentialless rehearsal only: callers supply simulated receipts, never a process runner. */
export const simulateCloudflarePublication = async (
    plan: ReturnType<typeof createCloudflarePublishPlan>,
    fixture: {
        simulation: true
        inspectedResources: () => Promise<unknown>
        run: (command: typeof plan.apply) => Promise<CommandResult>
        appliedNames: () => Promise<string[]>
        latestSourceSha: () => Promise<string>
        verifyVersion: (result: unknown) => Promise<boolean>
    },
) => {
    if (fixture.simulation !== true || plan.executionEnabled !== false)
        throw new Error('Only a credentialless simulation is supported.')
    verifyCloudflarePublisherResources(plan, await fixture.inspectedResources())
    const apply = await fixture.run(plan.apply)
    if (apply.exitCode !== 0 || apply.signal)
        throw new Error('Migration command did not exit normally; deployment is forbidden.')
    const pending = await fixture.run(plan.pending)
    confirmCloudflarePublisherMigrations(plan, {
        accountId: plan.resources.accountId,
        databaseId: plan.resources.database.id,
        apply,
        pending,
        appliedNames: await fixture.appliedNames(),
    })
    if ((await fixture.latestSourceSha()) !== plan.sourceSha)
        throw new Error('The source was superseded during migration; do not deploy stale output.')
    const deployed = await fixture.run(plan.deploy)
    if (deployed.exitCode !== 0 || deployed.signal)
        throw new Error('Deployment command did not exit normally; inspect the previous version.')
    if (plan.isPreview)
        parseCloudflarePreviewDeployment(deployed.output, {
            mode: plan.mode,
            siteUrl: plan.buildEnvironment.PUBLIC_SITE_URL,
        })
    if (!(await fixture.verifyVersion(deployed.output)))
        throw new Error('Specific deployed-version verification failed; cutover is forbidden.')
    return {
        simulationComplete: true as const,
        activationVerified: false as const,
        cloudflareOperations: 0 as const,
    }
}
