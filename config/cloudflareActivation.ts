import { createHash } from 'node:crypto'

import { z } from 'zod'

const sha = z.string().regex(/^[a-f0-9]{40}$/)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const proof = z.url().refine((url) => url.startsWith('https://'), 'HTTPS proof required')
const receipt = z.strictObject({
    version: z.literal(1),
    repository: z.literal('liria24/avatio'),
    action: z.enum(['deploy', 'cleanup', 'bootstrap', 'rollback']),
    mode: z.string(),
    sourceSha: sha,
    trustedCodeSha: sha,
    inventoryHash: digest,
    expiresAt: z.iso.datetime(),
    // Reviewed evidence, not an automatically generated assertion of successful activation.
    proofs: z.strictObject({
        buildAndBindings: proof,
        previewIsolationAndSecrets: proof,
        migrationHistoryAndRecovery: proof,
        environmentProtection: proof,
        singlePublisher: proof,
    }),
    previewSecretTransferApproved: z.boolean(),
    buildArtifactPublicationApproved: z.boolean(),
    ephemeralDeletionApproved: z.boolean(),
    resourceCreationApproved: z.boolean(),
    productionCutoverApproved: z.boolean(),
    productionRollbackApproved: z.boolean().default(false),
})

export const cloudflareInventoryHash = (input: unknown) =>
    createHash('sha256').update(JSON.stringify(input)).digest('hex')

/** A short-lived protected-Environment approval; not deployment state or a substitute plan engine. */
export const requireCloudflareActivation = (
    input: unknown,
    expected: {
        action: 'deploy' | 'cleanup' | 'bootstrap' | 'rollback'
        mode: string
        sourceSha: string
        trustedCodeSha: string
        inventory: unknown
        enabled: boolean
    },
    now = Date.now(),
) => {
    const result = receipt.safeParse(input)
    if (!expected.enabled || !result.success)
        throw new Error('Native delivery is inactive or lacks reviewed activation evidence.')
    const approval = result.data
    const expires = Date.parse(approval.expiresAt)
    if (
        approval.action !== expected.action ||
        approval.mode !== expected.mode ||
        approval.sourceSha !== expected.sourceSha ||
        approval.trustedCodeSha !== expected.trustedCodeSha ||
        approval.inventoryHash !== cloudflareInventoryHash(expected.inventory) ||
        expires <= now ||
        expires > now + 86_400_000
    )
        throw new Error(
            'Activation evidence is expired or differs from the exact reviewed operation.',
        )
    if (!/^(production|development|pr-[1-9]\d*)$/.test(expected.mode))
        throw new Error('Invalid reviewed mode.')
    if (
        expected.mode === 'production' &&
        (expected.action === 'rollback'
            ? !approval.productionRollbackApproved
            : expected.action !== 'deploy' || !approval.productionCutoverApproved)
    )
        throw new Error('Production cutover/rollback requires its explicit approval.')
    if (expected.action === 'rollback' && expected.mode !== 'production')
        throw new Error('Only the production Worker recovery path is supported.')
    if (
        expected.mode !== 'production' &&
        expected.action === 'deploy' &&
        !approval.previewSecretTransferApproved
    )
        throw new Error('Preview-scoped secret transfer requires approval.')
    if (
        expected.action === 'cleanup' &&
        (!/^pr-[1-9]\d*$/.test(expected.mode) || !approval.ephemeralDeletionApproved)
    )
        throw new Error('Dedicated PR cleanup requires approval.')
    if (
        expected.action === 'bootstrap' &&
        (!/^pr-[1-9]\d*$/.test(expected.mode) || !approval.resourceCreationApproved)
    )
        throw new Error('Dedicated PR resource creation requires approval.')
    return approval
}
