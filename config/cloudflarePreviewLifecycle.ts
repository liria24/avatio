import { z } from 'zod'

import { requireHttpsOrigin } from './build.ts'
import { createCloudflareConfig, type CloudflareResourceInventory } from './cloudflare.ts'
import type { DeploymentState } from './deployment.ts'

const identifier = z.string().regex(/^[a-zA-Z0-9_-]+$/)
const previewDeployment = z.strictObject({
    type: z.literal('preview'),
    version: z.literal(1),
    preview_id: identifier,
    preview_name: z.string(),
    preview_slug: identifier,
    preview_urls: z.array(z.string()).min(1),
    deployment_id: identifier,
    deployment_urls: z.array(z.string()).min(1),
})

/** cf@1.0.0-beta.11's public JSON result. No stable-URL fallback for version verification. */
export const parseCloudflarePreviewDeployment = (
    input: unknown,
    expected: { mode: string; siteUrl: string },
) => {
    if (!/^(development|pr-[1-9]\d*)$/.test(expected.mode))
        throw new Error('An explicit native Preview target is required.')
    const result = previewDeployment.parse(input)
    if (result.preview_name !== expected.mode || result.preview_slug !== expected.mode)
        throw new Error('The deployed Preview identity differs from the requested target.')
    const stableUrl = requireHttpsOrigin(expected.siteUrl, 'Reviewed Preview URL')
    const previews = result.preview_urls.map((url) => requireHttpsOrigin(url, 'Preview URL'))
    const deployments = result.deployment_urls.map((url) =>
        requireHttpsOrigin(url, 'Deployment URL'),
    )
    if (!previews.includes(stableUrl))
        throw new Error('The reviewed Preview URL is missing from the deployment result.')
    if (deployments.some((url) => previews.includes(url)))
        throw new Error('Version verification requires a deployment-specific URL.')

    // Native URL shapes documented by Workers Previews; never accept a different account/host.
    const stable = new URL(stableUrl)
    const suffix = stable.hostname.endsWith('.workers.dev')
        ? stable.hostname.slice(`${expected.mode}-avatio`.length)
        : stable.hostname.slice(expected.mode.length)
    if (
        !suffix.startsWith('.') ||
        stable.hostname !==
            `${expected.mode}${stable.hostname.endsWith('.workers.dev') ? '-avatio' : ''}${suffix}`
    )
        throw new Error('The reviewed URL must identify this native Preview.')
    const deploymentUrl = `https://${result.deployment_id}${stable.hostname.endsWith('.workers.dev') ? '-avatio' : `-${expected.mode}`}${suffix}`
    if (stable.port || !deployments.includes(deploymentUrl))
        throw new Error('The exact deployment URL does not match the reviewed Preview host.')
    return {
        mode: expected.mode,
        previewId: result.preview_id,
        deploymentId: result.deployment_id,
        stableUrl,
        deploymentUrl,
    }
}

const closedPr = z.object({
    number: z.number().int().positive().safe(),
    state: z.literal('closed'),
    head: z.object({ repo: z.object({ full_name: z.literal('liria24/avatio') }) }),
    base: z.object({
        ref: z.enum(['main', 'development']),
        repo: z.object({ full_name: z.literal('liria24/avatio') }),
    }),
})

const inspectionSchema = z.strictObject({
    accountId: z.string(),
    workerName: z.literal('avatio'),
    complete: z.literal(true),
    resources: z.strictObject({
        preview: z.strictObject({ id: identifier, name: z.string() }).nullable(),
        database: z.strictObject({ id: z.string(), name: z.string() }).nullable(),
        cache: z.strictObject({ id: z.string(), name: z.string() }).nullable(),
        bucket: z.strictObject({ name: z.string() }).nullable(),
    }),
})

/** App-specific ownership checks only; no provisioning, state store, or remote mutations. */
export const createCloudflarePreviewCleanupPlan = (input: {
    pr: unknown
    inventory: CloudflareResourceInventory
    inspection: unknown
    trustedCode: DeploymentState
    trustedRef: string
    trustedSha: string
}) => {
    const pr = closedPr.parse(input.pr)
    const mode = `pr-${pr.number}`
    if (
        !/^[a-f0-9]{40}$/.test(input.trustedSha) ||
        input.trustedCode.commit !== input.trustedSha ||
        input.trustedCode.dirty ||
        input.trustedRef !== `refs/heads/${pr.base.ref}` ||
        (input.trustedCode.branch !== pr.base.ref && input.trustedCode.branch !== null) ||
        input.trustedCode.ci?.ref !== input.trustedRef ||
        input.trustedCode.ci.commit !== input.trustedSha
    )
        throw new Error('Cleanup requires the exact clean trusted base-branch checkout.')
    // Reuse the full binding/isolation policy; no weaker cleanup-specific inventory schema.
    createCloudflareConfig({ mode, isPreview: true }, input.inventory)
    const target = input.inventory.previews?.[mode]
    if (!target) throw new Error('Cleanup requires a reviewed PR resource identity.')
    const inspection = inspectionSchema.parse(input.inspection)
    if (inspection.accountId !== input.inventory.accountId || inspection.workerName !== 'avatio')
        throw new Error('Cleanup requires successful reads of all resources in the exact account.')
    const { preview, database, cache, bucket } = inspection.resources
    if (
        target.database.id.toLowerCase() ===
            input.inventory.sharedPreviewStorage.database.id.toLowerCase() &&
        (!database || !bucket)
    )
        throw new Error('Shared Preview D1 and R2 must exist before cleanup can proceed.')
    if (
        (preview && (!identifier.safeParse(preview.id).success || preview.name !== mode)) ||
        (database &&
            (database.id !== target.database.id || database.name !== target.database.name)) ||
        (cache && (cache.id !== target.cache.id || cache.name !== target.cache.name)) ||
        (bucket && bucket.name !== target.bucket)
    )
        throw new Error('Observed PR resource ownership differs from the reviewed inventory.')
    return {
        mode,
        accountId: input.inventory.accountId,
        workerName: 'avatio' as const,
        retainedDatabase:
            target.database.id.toLowerCase() ===
            input.inventory.sharedPreviewStorage.database.id.toLowerCase()
                ? target.database
                : null,
        retainedBucket:
            target.bucket === input.inventory.sharedPreviewStorage.bucket
                ? { name: target.bucket }
                : null,
        // Absent resources make retries idempotent, but unavailable reads are never absence.
        resources: { preview, database, cache, bucket },
    }
}

/** Verify fresh reads, not a delete command's exit code. The caller must serialize with reopen. */
export const verifyCloudflarePreviewCleanup = (
    plan: ReturnType<typeof createCloudflarePreviewCleanupPlan>,
    pr: unknown,
    input: unknown,
) => {
    const current = closedPr.parse(pr)
    const inspection = inspectionSchema.parse(input)
    if (
        plan.mode !== `pr-${current.number}` ||
        !inspection.complete ||
        inspection.accountId !== plan.accountId ||
        inspection.workerName !== plan.workerName ||
        inspection.resources.preview !== null ||
        inspection.resources.cache !== null ||
        (plan.retainedBucket
            ? inspection.resources.bucket?.name !== plan.retainedBucket.name
            : inspection.resources.bucket !== null) ||
        (plan.retainedDatabase
            ? inspection.resources.database?.id !== plan.retainedDatabase.id ||
              inspection.resources.database?.name !== plan.retainedDatabase.name
            : inspection.resources.database !== null)
    )
        throw new Error('Cleanup is incomplete or PR identity/state changed; stop and inspect.')
    return { mode: plan.mode, absenceVerified: true as const }
}
