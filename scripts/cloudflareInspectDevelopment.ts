import { isDeepStrictEqual } from 'node:util'

import { requireHttpsOrigin } from '../config/build.ts'
import {
    getCloudflareDevelopmentInspectionConfiguration,
    type CloudflareResourceInventory,
} from '../config/cloudflare.ts'
import {
    developmentSchemaSql,
    developmentLedgerSql,
    requireCloudflareDevelopmentLedger,
    confirmCloudflareDevelopmentLedgerUnchanged,
} from './cloudflareDevelopmentLedger.ts'
import { createCloudflareNativeApi } from './cloudflareNativeApi.ts'
import {
    NativeDiagnosticError,
    nativePhase,
    type NativeReporter,
} from './cloudflareNativeDiagnostics.ts'
import { verifyCloudflareStaticDeploymentHttp } from './cloudflarePreviewSmoke.ts'

/** Manual inspection of existing development only. No publication, secrets input or migrations. */
export const inspectCloudflareDevelopment = async (input: {
    context: {
        repository: string
        eventName: string
        ref: string
        actor: string
        triggeringActor: string
        trustedCodeSha: string
        currentDevelopmentSha: string
        clean: boolean
    }
    historicalSourceSha: string
    expectedPreviewId: string
    deploymentId: string
    reviewedImmutableUrl?: string
    inventory: CloudflareResourceInventory
    token: string
    files: Parameters<typeof requireCloudflareDevelopmentLedger>[1]['files']
    fetcher?: typeof fetch
    httpFetch?: typeof fetch
    reportDiagnostic?: NativeReporter
}) => {
    const phase = <T>(name: Parameters<typeof nativePhase>[0], operation: () => Promise<T> | T) =>
        nativePhase(name, input.reportDiagnostic, operation)
    const { configuration } = await phase('inspection-inputs', () => {
        const context = input.context
        if (
            context.repository !== 'liria24/avatio' ||
            context.eventName !== 'workflow_dispatch' ||
            context.ref !== 'refs/heads/development' ||
            context.actor !== 'liry24' ||
            context.triggeringActor !== 'liry24' ||
            !context.clean ||
            !/^[a-f0-9]{40}$/.test(context.trustedCodeSha) ||
            context.trustedCodeSha !== context.currentDevelopmentSha ||
            !/^[a-f0-9]{40}$/.test(input.historicalSourceSha) ||
            !/^[\w-]{1,128}$/.test(input.expectedPreviewId) ||
            !/^[\w-]{1,128}$/.test(input.deploymentId)
        )
            throw new NativeDiagnosticError('operation-failed')
        const result = getCloudflareDevelopmentInspectionConfiguration(input.inventory)
        if (
            input.reviewedImmutableUrl &&
            (requireHttpsOrigin(input.reviewedImmutableUrl, 'Reviewed immutable URL') !==
                input.reviewedImmutableUrl ||
                input.reviewedImmutableUrl === result.resources.siteUrl)
        )
            throw new NativeDiagnosticError('preview-url-mismatch')
        return result
    })
    const api = createCloudflareNativeApi(input.inventory, input.token, input.fetcher)
    const observed = await phase('inspection-resources', async () => {
        const result = await api.inspect()
        if (result.preview?.id !== input.expectedPreviewId)
            throw new NativeDiagnosticError('preview-parent-mismatch')
        return result
    })
    const ledgerExpected = {
        inventory: input.inventory,
        trustedCodeSha: input.context.trustedCodeSha,
        filesSha: input.context.trustedCodeSha,
        files: input.files,
        migrationNames: input.files.map((file) => file.name).sort(),
    }
    const snapshot = async () => ({
        complete: true,
        accountId: configuration.accountId,
        databaseId: input.inventory.development.database.id,
        schema: await api.query(developmentSchemaSql),
        alchemy: await api.query(developmentLedgerSql),
    })
    const before = await phase('inspection-ledger', async () =>
        requireCloudflareDevelopmentLedger(await snapshot(), ledgerExpected),
    )
    const latest = await phase('inspection-deployment', () =>
        api.deployment('latest', input.expectedPreviewId, input.reviewedImmutableUrl),
    )
    const exact =
        input.deploymentId === 'latest'
            ? latest
            : await phase('inspection-deployment', () =>
                  api.deployment(
                      input.deploymentId,
                      input.expectedPreviewId,
                      input.reviewedImmutableUrl,
                  ),
              )
    const issues: NativeDiagnosticError[] = []
    if (!exact) issues.push(new NativeDiagnosticError('preview-deployment-mismatch'))
    if (exact && !exact.bindingsVerified)
        issues.push(new NativeDiagnosticError('preview-bindings-mismatch'))
    if (exact?.sourceAnnotationPresent && exact.sourceSha !== input.historicalSourceSha)
        issues.push(new NativeDiagnosticError('preview-source-mismatch'))
    if (input.reviewedImmutableUrl && !exact?.reviewedUrlPresent)
        issues.push(new NativeDiagnosticError('preview-url-mismatch'))
    input.reportDiagnostic?.({
        phase: 'inspection-deployment',
        outcome: issues.length ? 'failed' : 'verified',
        ...(issues[0] ? { code: issues[0].code } : {}),
        bindingsVerified: exact?.bindingsVerified ?? false,
        requiredSecrets: exact?.requiredSecrets ?? [],
        unexpectedBindingCount: exact?.unexpectedBindingCount ?? 0,
    })
    let staticHttpVerified = false
    if (!issues.length && input.reviewedImmutableUrl) {
        try {
            await phase('inspection-http', () =>
                verifyCloudflareStaticDeploymentHttp(input.reviewedImmutableUrl!, input.httpFetch),
            )
            staticHttpVerified = true
        } catch (error) {
            issues.push(
                error instanceof NativeDiagnosticError
                    ? error
                    : new NativeDiagnosticError('operation-failed'),
            )
        }
    }
    await phase('inspection-postflight', async () => {
        confirmCloudflareDevelopmentLedgerUnchanged(before, await snapshot(), ledgerExpected)
        if ((await api.preview())?.id !== observed.preview?.id)
            throw new NativeDiagnosticError('preview-parent-changed')
        if (
            exact &&
            !isDeepStrictEqual(
                exact,
                await api.deployment(exact.id, input.expectedPreviewId, input.reviewedImmutableUrl),
            )
        )
            throw new NativeDiagnosticError('preview-deployment-mismatch')
        if (
            (await api.deployment('latest', input.expectedPreviewId, input.reviewedImmutableUrl))
                ?.id !== latest?.id
        )
            throw new NativeDiagnosticError('preview-deployment-mismatch')
    })
    if (issues.length) throw issues[0]
    return {
        mode: 'development',
        inspectionCodeSha: input.context.trustedCodeSha,
        reviewedHistoricalSourceSha: input.historicalSourceSha,
        deploymentPresent: exact !== null,
        exactIsLatest: exact?.id === latest?.id,
        bindingsVerified: exact?.bindingsVerified ?? false,
        requiredSecrets: exact?.requiredSecrets ?? [],
        sourceAnnotationMatchesHistoricalSource: exact?.sourceSha === input.historicalSourceSha,
        sourceProvenanceVerified: false,
        ledgerVerified: true,
        schemaObjects: before.schema.length,
        ledgerRows: before.alchemy.length,
        rowsWritten: 0,
        staticHttpVerified,
        applicationRuntimeVerified: false,
        mutationsExecuted: false,
        activationVerified: false,
    }
}
