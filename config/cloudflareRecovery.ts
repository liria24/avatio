import { z } from 'zod'

import { cloudflareInventoryHash } from './cloudflareActivation.ts'

const recovery = z.strictObject({
    version: z.literal(1),
    accountId: z.string(),
    workerName: z.literal('avatio'),
    previousVersionId: z.uuid(),
    databaseId: z.uuid(),
    inventoryHash: z.string(),
    appliedMigrationNames: z.array(z.string().regex(/^\d{14}_[\w-]+\/migration\.sql$/)).min(1),
    backwardCompatibleDatabase: z.literal(true),
    recoveryPointEvidence: z.url(),
    rehearsalEvidence: z.url(),
})

/** A reviewed recovery point, not a history database. Worker rollback never restores D1. */
export const requireCloudflareRecovery = (
    input: unknown,
    target: { accountId: string; databaseId: string; inventory: unknown },
) => {
    const parsed = recovery.safeParse(input)
    if (!parsed.success)
        throw new Error(
            'A reviewed production recovery point and database compatibility rehearsal are required.',
        )
    const value = parsed.data
    if (
        value.accountId !== target.accountId ||
        value.databaseId !== target.databaseId ||
        value.inventoryHash !== cloudflareInventoryHash(target.inventory) ||
        new Set(value.appliedMigrationNames).size !== value.appliedMigrationNames.length ||
        ![value.recoveryPointEvidence, value.rehearsalEvidence].every((url) =>
            url.startsWith('https://'),
        )
    )
        throw new Error('Recovery evidence differs from the exact reviewed production resources.')
    return { ...value, databaseRollback: false as const, legacyResourceDeletion: false as const }
}
