import { createHash } from 'node:crypto'

import { z } from 'zod'

import { createCloudflareConfig, type CloudflareResourceInventory } from '../config/cloudflare.ts'
import { cloudflareInventoryHash } from '../config/cloudflareActivation.ts'
import { mapCloudflareMigrationHistory } from './cloudflareMigrationHistory.ts'

const sha = /^[a-f0-9]{40}$/
const digest = /^[a-f0-9]{64}$/
const runId = /^[1-9]\d*$/
const developmentRef = 'refs/heads/development'
const receipt = z.strictObject({
    version: z.literal(1),
    repository: z.literal('liria24/avatio'),
    action: z.literal('rehearse'),
    mode: z.literal('development'),
    sourceSha: z.string().regex(sha),
    trustedCodeSha: z.string().regex(sha),
    qualityRunId: z.string().regex(runId),
    inventoryHash: z.string().regex(digest),
    expiresAt: z.iso.datetime(),
    buildArtifactPublicationApproved: z.literal(true),
    previewSecretTransferApproved: z.literal(true),
    incidentalNonProductionRuntimeWritesApproved: z.literal(true),
    publicInitialPreviewApproved: z.literal(true),
})

/** Separate manual runtime approval. It does not establish migration or publisher activation. */
export const requireCloudflareDevelopmentRehearsal = (
    input: unknown,
    expected: {
        action: string
        mode: string
        eventName: string
        sourceRef: string
        trustedRef: string
        sourceSha: string
        latestSourceSha: string
        trustedCodeSha: string
        // Fresh successful development quality, selected by resolveCloudflareDeliveryPreflight.
        quality: { runId: string; sourceSha: string; succeeded: boolean }
        inventory: CloudflareResourceInventory
    },
    now = Date.now(),
) => {
    const parsed = receipt.safeParse(input)
    if (!parsed.success)
        throw new Error('Explicit development runtime rehearsal approval required.')
    const approval = parsed.data
    const expires = Date.parse(approval.expiresAt)
    if (
        expected.action !== 'rehearse' ||
        expected.mode !== 'development' ||
        expected.eventName !== 'workflow_dispatch' ||
        expected.sourceRef !== developmentRef ||
        expected.trustedRef !== developmentRef ||
        expected.quality.succeeded !== true ||
        approval.qualityRunId !== expected.quality.runId ||
        [
            expected.sourceSha,
            expected.latestSourceSha,
            expected.trustedCodeSha,
            expected.quality.sourceSha,
        ].some((value) => value !== approval.sourceSha) ||
        approval.trustedCodeSha !== approval.sourceSha ||
        approval.inventoryHash !== cloudflareInventoryHash(expected.inventory) ||
        !Number.isFinite(now) ||
        expires <= now ||
        expires > now + 86_400_000
    )
        throw new Error(
            'Rehearsal approval differs from current reviewed development quality or is expired.',
        )
    createCloudflareConfig({ mode: 'development', isPreview: true }, expected.inventory)
    return approval
}

const snapshotSchema = z.strictObject({
    complete: z.literal(true),
    accountId: z.string().regex(/^[a-f0-9]{32}$/),
    databaseId: z.uuid(),
    // Full sqlite_schema except sqlite_*/_cf_* internals; no application row data.
    schema: z
        .array(
            z
                .strictObject({
                    type: z.enum(['table', 'index', 'trigger', 'view']),
                    name: z.string().min(1),
                    tableName: z.string().min(1),
                    sql: z.string().nullable(),
                })
                .refine((row) =>
                    typeof row.sql === 'string' ? row.sql.trim().length > 0 : row.type === 'index',
                ),
        )
        .min(1),
    alchemy: z
        .array(
            z.strictObject({
                id: z.number().int().safe(),
                name: z.string().min(1),
                hash: z.string().regex(digest),
                appliedAt: z.string().min(1),
            }),
        )
        .min(1),
})

interface LedgerExpectation {
    inventory: CloudflareResourceInventory
    trustedCodeSha: string
    filesSha: string
    // Complete readCommittedCloudflareMigrations() result from the clean trusted checkout.
    files: readonly { name: string; hash: string; sql: string }[]
    migrationNames: readonly string[]
}

/** No DDL, imports or migration commands: every trusted SQL file must already be hash-verified. */
export const requireCloudflareDevelopmentLedger = (input: unknown, expected: LedgerExpectation) => {
    const parsed = snapshotSchema.safeParse(input)
    if (!parsed.success)
        throw new Error('Complete successful development ledger/schema reads required.')
    const snapshot = parsed.data
    const configuration = createCloudflareConfig(
        { mode: 'development', isPreview: true },
        expected.inventory,
    )
    const database = configuration.worker.env.APP_DB
    const names = expected.files.map((file) => file.name).sort()
    if (
        !sha.test(expected.trustedCodeSha) ||
        expected.filesSha !== expected.trustedCodeSha ||
        database?.type !== 'd1' ||
        snapshot.accountId !== configuration.accountId ||
        snapshot.databaseId.toLowerCase() !== database.id ||
        !names.length ||
        JSON.stringify(names) !== JSON.stringify(expected.migrationNames) ||
        expected.files.some(
            (file) => createHash('sha256').update(file.sql).digest('hex') !== file.hash,
        ) ||
        !snapshot.schema.some(
            (row) => row.type === 'table' && row.name === '__alchemy_migrations',
        ) ||
        snapshot.schema.some((row) => row.name.toLowerCase() === 'd1_migrations') ||
        new Set(snapshot.schema.map((row) => `${row.type}:${row.name}`)).size !==
            snapshot.schema.length ||
        new Set(snapshot.alchemy.map((row) => row.id)).size !== snapshot.alchemy.length
    )
        throw new Error(
            'Development ledger target, trusted SQL set or schema differs from the reviewed rehearsal.',
        )
    const mapping = mapCloudflareMigrationHistory(expected.files, snapshot.alchemy, [])
    if (mapping.pending.length || mapping.imports.length !== expected.files.length)
        throw new Error(
            'Runtime rehearsal requires every trusted migration already applied by Alchemy.',
        )
    return {
        ...snapshot,
        schema: [...snapshot.schema].sort((a, b) =>
            `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`),
        ),
        alchemy: [...snapshot.alchemy].sort((a, b) => a.id - b.id),
    }
}

/** Incidental application writes are approved separately; migration metadata/schema must not change. */
export const confirmCloudflareDevelopmentLedgerUnchanged = (
    before: unknown,
    after: unknown,
    expected: LedgerExpectation,
) => {
    if (
        JSON.stringify(requireCloudflareDevelopmentLedger(before, expected)) !==
        JSON.stringify(requireCloudflareDevelopmentLedger(after, expected))
    )
        throw new Error('Development migration history or schema changed during runtime rehearsal.')
    return { ledgerUnchanged: true as const, migrationCompatibilityVerified: false as const }
}
