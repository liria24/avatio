import { verifyCloudflarePublisherResources } from '../config/cloudflarePublisher.ts'
import {
    requireCloudflareDevelopmentRehearsal,
    requireCloudflareDevelopmentLedger,
    confirmCloudflareDevelopmentLedgerUnchanged,
} from './cloudflareDevelopmentRehearsal.ts'
import type { createCloudflareNativeApi } from './cloudflareNativeApi.ts'
import { publishCloudflarePreviewArtifact } from './cloudflareNativePublication.ts'

type Plan = Parameters<typeof publishCloudflarePreviewArtifact>[0]
type Publication = Parameters<typeof publishCloudflarePreviewArtifact>[1]
type Expected = Parameters<typeof requireCloudflareDevelopmentRehearsal>[1]
type Ledger = Parameters<typeof requireCloudflareDevelopmentLedger>[1]

/** One initial, manually approved Preview rehearsal. Never migrates or activates delivery. */
export const rehearseCloudflareDevelopment = async (
    plan: Plan,
    input: {
        approval: unknown
        expected: Expected
        files: Ledger['files']
        filesSha: string
        api: ReturnType<typeof createCloudflareNativeApi>
        runtimeSecrets: Publication['runtimeSecrets']
        run: Publication['run']
        httpFetch?: typeof fetch
        latestSourceSha: () => Promise<string>
        reportPostflight?: (verified: boolean) => void
    },
) => {
    requireCloudflareDevelopmentRehearsal(input.approval, input.expected)
    const inventory = input.expected.inventory
    if (
        plan.mode !== 'development' ||
        !plan.isPreview ||
        plan.sourceSha !== input.expected.sourceSha ||
        plan.resources.accountId !== inventory.accountId ||
        plan.resources.database.id !== inventory.development.database.id ||
        plan.resources.database.name !== inventory.development.database.name
    )
        throw new Error('Rehearsal requires the exact reviewed development Preview and D1.')
    const requireCurrentSource = async () => {
        requireCloudflareDevelopmentRehearsal(input.approval, {
            ...input.expected,
            latestSourceSha: await input.latestSourceSha(),
        })
    }
    await requireCurrentSource()
    const inspected = await input.api.inspect(plan.mode, inventory)
    const { preview, ...resources } = inspected.resources
    verifyCloudflarePublisherResources(plan, { ...inspected, resources })
    if (preview) throw new Error('Initial rehearsal must not replace an existing native Preview.')
    const ledgerExpected: Ledger = {
        inventory,
        trustedCodeSha: input.expected.trustedCodeSha,
        filesSha: input.filesSha,
        files: input.files,
        migrationNames: plan.migrationNames,
    }
    const snapshot = async () => ({
        complete: true,
        accountId: inventory.accountId,
        databaseId: inventory.development.database.id,
        schema: await input.api.query(
            inventory.development.database.id,
            "SELECT type, name, tbl_name AS tableName, sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type, name",
        ),
        alchemy: await input.api.query(
            inventory.development.database.id,
            'SELECT id, name, hash, applied_at AS appliedAt FROM __alchemy_migrations ORDER BY id',
        ),
    })
    const before = await snapshot()
    requireCloudflareDevelopmentLedger(before, ledgerExpected)
    await requireCurrentSource()
    const failures: unknown[] = []
    let publication: Awaited<ReturnType<typeof publishCloudflarePreviewArtifact>> | undefined
    try {
        const created = await input.api.createInitialDevelopmentPreview()
        await requireCurrentSource()
        const current = await input.api.preview('development')
        if (
            current?.id !== created.id ||
            (await input.api.previewDeployment('development', 'latest', true)) !== null
        )
            throw new Error('Initial Preview changed or already has a deployment; stop for review.')
        // No apply/list migration command and no SQL mutation belongs in this path.
        // Runtime smoke can write application rate-limit state, covered by its separate approval.
        publication = await publishCloudflarePreviewArtifact(plan, {
            inventory,
            api: input.api,
            runtimeSecrets: input.runtimeSecrets,
            expectedPreviewId: created.id,
            run: (command) => {
                if (command !== plan.deploy)
                    throw new Error('Only the reviewed Preview deployment command is permitted.')
                return input.run(command)
            },
            httpFetch: input.httpFetch,
        })
    } catch (error) {
        failures.push(error)
    }
    // Check read-only postflight even after partial publication or a rejected secret PATCH.
    let postflightVerified = false
    try {
        confirmCloudflareDevelopmentLedgerUnchanged(before, await snapshot(), ledgerExpected)
        await requireCurrentSource()
        postflightVerified = true
    } catch (error) {
        failures.push(error)
    }
    try {
        input.reportPostflight?.(postflightVerified)
    } catch (error) {
        failures.push(error)
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1)
        throw new AggregateError(failures, 'Publication and rehearsal postflight both failed.')
    if (!publication) throw new Error('No verified Preview publication was returned.')
    return {
        ...publication,
        rehearsalVerified: true as const,
        activationVerified: false as const,
        migrationsExecuted: false as const,
        populatedRecoveryVerified: false as const,
    }
}
