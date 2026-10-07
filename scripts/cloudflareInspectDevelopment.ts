import { isDeepStrictEqual } from 'node:util'

import {
    getCloudflareDevelopmentInspectionConfiguration,
    type CloudflareResourceInventory,
} from '../config/cloudflare.ts'
import { parseCloudflarePreviewDeployment } from '../config/cloudflarePreviewLifecycle.ts'
import {
    developmentSchemaSql,
    developmentLedgerSql,
    requireCloudflareDevelopmentLedger,
    confirmCloudflareDevelopmentLedgerUnchanged,
} from './cloudflareDevelopmentLedger.ts'
import {
    createCloudflareNativeApi,
    verifyCloudflarePreviewBindings,
} from './cloudflareNativeApi.ts'
import {
    NativeDiagnosticError,
    nativePhase,
    type NativeReporter,
} from './cloudflareNativeDiagnostics.ts'
import { inspectCloudflarePreviewMetadata } from './cloudflarePreviewMetadata.ts'
import { verifyCloudflareStaticDeploymentHttp } from './cloudflarePreviewSmoke.ts'

/** Supported API inspection only. No publisher, migration runner or application secret input. */
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
    expectedPreviewId?: string
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
    const configuration = await phase('inspection-inputs', () => {
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
            !/^[\w-]+$/.test(input.deploymentId) ||
            (input.expectedPreviewId !== undefined && !/^[\w-]+$/.test(input.expectedPreviewId)) ||
            (input.reviewedImmutableUrl && !input.expectedPreviewId)
        )
            throw new Error(
                'Inspection requires current trusted manual development code and reviewed inputs.',
            )
        return getCloudflareDevelopmentInspectionConfiguration(input.inventory).configuration
    })
    const api = createCloudflareNativeApi(
        configuration.accountId,
        input.token,
        input.fetcher,
        {
            databaseId: input.inventory.development.database.id,
            bucket: input.inventory.development.bucket,
        },
        input.reportDiagnostic,
        Object.keys(configuration.worker.env),
    )
    const observed = await phase('inspection-resources', async () => {
        const observed = await api.inspect('development', input.inventory)
        const target = input.inventory.development
        if (
            observed.resources.database?.id !== target.database.id ||
            observed.resources.database.name !== target.database.name ||
            observed.resources.cache?.id !== target.cache.id ||
            observed.resources.cache.name !== target.cache.name ||
            observed.resources.bucket?.name !== target.bucket ||
            (input.expectedPreviewId && observed.resources.preview?.id !== input.expectedPreviewId)
        )
            throw new Error('Reviewed development resource or Preview identity differs.')
        input.reportDiagnostic?.({
            phase: 'inspection-resources',
            outcome: 'verified',
            evidence: { previewPresent: observed.resources.preview !== null },
        })
        return observed
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
        schema: await api.query(input.inventory.development.database.id, developmentSchemaSql),
        alchemy: await api.query(input.inventory.development.database.id, developmentLedgerSql),
    })
    const before = await phase('inspection-ledger', async () =>
        requireCloudflareDevelopmentLedger(await snapshot(), ledgerExpected),
    )
    const verifyIdentity = (
        deployment: Awaited<ReturnType<typeof api.previewDeployment>>,
        exactId?: string,
    ) => {
        const evidence = {
            deploymentPresent: deployment !== null,
            parentMatches: !!deployment && deployment.preview_id === observed.resources.preview?.id,
            previewNameMatches: deployment?.preview_name === 'development',
            deploymentIdValid:
                !!deployment && typeof deployment.id === 'string' && /^[\w-]+$/.test(deployment.id),
            exactIdMatches: !!deployment && (exactId === undefined || deployment.id === exactId),
        }
        input.reportDiagnostic?.({
            phase: exactId ? 'inspection-exact-identity' : 'inspection-latest-identity',
            outcome: 'started',
            evidence,
        })
        if (!deployment) return
        if (!evidence.deploymentIdValid)
            throw new NativeDiagnosticError('preview-deployment-id-invalid', evidence)
        if (!evidence.parentMatches)
            throw new NativeDiagnosticError('preview-parent-id-mismatch', evidence)
        if (!evidence.previewNameMatches)
            throw new NativeDiagnosticError('preview-name-mismatch', evidence)
        if (!evidence.exactIdMatches)
            throw new NativeDiagnosticError('preview-exact-id-mismatch', evidence)
    }
    const failures: unknown[] = []
    let bindingsVerified = false
    const issues: (
        | 'url-contract-mismatch'
        | 'bindings-mismatch'
        | 'source-mismatch'
        | 'reviewed-url-mismatch'
    )[] = []
    const result = await phase('inspection-metadata-collection', async () => {
        const latest = observed.resources.preview
            ? await phase('inspection-latest-read', () =>
                  api.previewDeployment(
                      'development',
                      'latest',
                      true,
                      observed.resources.preview?.id,
                  ),
              )
            : null
        await phase('inspection-latest-identity', () => verifyIdentity(latest))
        const exact =
            input.deploymentId === 'latest'
                ? latest
                : await phase('inspection-exact-read', () =>
                      api.previewDeployment(
                          'development',
                          input.deploymentId,
                          false,
                          observed.resources.preview?.id,
                      ),
                  )
        if (input.deploymentId !== 'latest')
            await phase('inspection-exact-identity', () =>
                verifyIdentity(exact, input.deploymentId),
            )
        input.reportDiagnostic?.({
            phase: 'inspection-deployment',
            outcome: 'started',
            evidence: {
                deploymentPresent: !!exact,
                parentMatches: !!exact && exact.preview_id === observed.resources.preview?.id,
                sourceAnnotationPresent: exact?.sourceSha !== undefined,
                sourceAnnotationMatches: exact?.sourceSha === input.historicalSourceSha,
                requiredSecrets: (
                    [
                        'BETTER_AUTH_SECRET',
                        'NUXT_BETTER_AUTH_SECRET',
                        'TWITTER_CLIENT_SECRET',
                    ] as const
                )
                    .filter((name) => configuration.worker.env[name]?.type === 'secret')
                    .map((name) => ({
                        name,
                        secretTypePresent: exact?.env[name]?.type === 'secret_text',
                    })),
                requiredSecretTypesPresent:
                    !!exact &&
                    Object.entries(configuration.worker.env)
                        .filter(([, binding]) => binding.type === 'secret')
                        .every(([name]) => exact.env[name]?.type === 'secret_text'),
            },
        })
        if (!exact) {
            if (input.deploymentId !== 'latest' || input.reviewedImmutableUrl)
                throw new Error('Reviewed exact deployment is unavailable.')
            return { latest, exact, deployment: null }
        }
        const audit = inspectCloudflarePreviewMetadata(
            exact,
            configuration.worker.env,
            input.inventory.development.siteUrl,
        )
        let deployment: ReturnType<typeof parseCloudflarePreviewDeployment> | null = null
        try {
            deployment = await phase('inspection-deployment', () => {
                try {
                    return parseCloudflarePreviewDeployment(
                        {
                            type: 'preview',
                            version: 1,
                            preview_id: exact.preview_id,
                            preview_name: exact.preview_name,
                            preview_slug: 'development',
                            preview_urls: [input.inventory.development.siteUrl],
                            deployment_id: exact.id,
                            deployment_urls: exact.urls,
                        },
                        { mode: 'development', siteUrl: input.inventory.development.siteUrl },
                    )
                } catch (cause) {
                    throw new NativeDiagnosticError('preview-url-contract-mismatch', {}, cause)
                }
            })
        } catch (error) {
            failures.push(error)
            issues.push('url-contract-mismatch')
        }
        try {
            await phase('binding-verification', () => {
                try {
                    return verifyCloudflarePreviewBindings(exact, configuration.worker.env, {
                        mode: 'development',
                        deploymentId: exact.id,
                    })
                } catch (cause) {
                    throw new NativeDiagnosticError(
                        'preview-bindings-mismatch',
                        { bindingsVerified: false },
                        cause,
                    )
                }
            })
            bindingsVerified = true
        } catch (error) {
            failures.push(error)
            issues.push('bindings-mismatch')
        }
        if (
            input.reviewedImmutableUrl &&
            deployment &&
            input.reviewedImmutableUrl !== deployment.deploymentUrl
        ) {
            issues.push('reviewed-url-mismatch')
            failures.push(new NativeDiagnosticError('preview-url-contract-mismatch'))
        }
        if (exact.sourceSha !== undefined && exact.sourceSha !== input.historicalSourceSha) {
            issues.push('source-mismatch')
            failures.push(
                new NativeDiagnosticError('preview-source-mismatch', {
                    sourceAnnotationPresent: true,
                    sourceAnnotationMatches: false,
                }),
            )
        }
        input.reportDiagnostic?.({
            phase: 'inspection-contract-audit',
            outcome: issues.length ? 'failed' : 'verified',
            evidence: { contractAudit: { ...audit, issues }, bindingsVerified },
        })
        return { latest, exact, deployment }
    })
    let staticHttpVerified = false
    try {
        if (!failures.length && input.reviewedImmutableUrl && result.deployment) {
            await phase('inspection-http', () =>
                verifyCloudflareStaticDeploymentHttp(
                    result.deployment!.deploymentUrl,
                    input.httpFetch,
                ),
            )
            staticHttpVerified = true
        }
    } catch (error) {
        failures.push(error)
    }
    try {
        await phase('inspection-postflight', async () => {
            confirmCloudflareDevelopmentLedgerUnchanged(before, await snapshot(), ledgerExpected)
            const current = await api.preview('development')
            if (current?.id !== observed.resources.preview?.id)
                throw new Error('Preview identity changed during inspection.')
            if (result.exact) {
                const exact = await api.previewDeployment(
                    'development',
                    result.exact.id,
                    false,
                    observed.resources.preview?.id,
                )
                if (
                    !exact ||
                    !isDeepStrictEqual(
                        {
                            id: exact.id,
                            env: exact.env,
                            urls: exact.urls,
                            sourceSha: exact.sourceSha,
                        },
                        {
                            id: result.exact.id,
                            env: result.exact.env,
                            urls: result.exact.urls,
                            sourceSha: result.exact.sourceSha,
                        },
                    )
                )
                    throw new Error('Exact deployment metadata changed during inspection.')
                const latest = await api.previewDeployment(
                    'development',
                    'latest',
                    true,
                    observed.resources.preview?.id,
                )
                if (latest?.id !== result.latest?.id)
                    throw new Error('Latest deployment changed during inspection.')
            }
        })
    } catch (error) {
        failures.push(error)
    }
    if (failures.length)
        throw new AggregateError(
            failures,
            `Inspection verification failed (${issues.map((issue) => (issue === 'reviewed-url-mismatch' ? 'preview-url-contract-mismatch' : `preview-${issue}`)).join(',')}); nothing was mutated.`,
        )
    return {
        mode: 'development',
        inspectionCodeSha: input.context.trustedCodeSha,
        reviewedHistoricalSourceSha: input.historicalSourceSha,
        inspectionCodeMatchesHistoricalSource:
            input.context.trustedCodeSha === input.historicalSourceSha,
        previewPresent: observed.resources.preview !== null,
        reviewedPreviewIdentityVerified: !!input.expectedPreviewId,
        deploymentPresent: !!result.exact,
        latestDeploymentPresent: !!result.latest,
        exactIsLatest: !!result.exact && result.exact.id === result.latest?.id,
        bindingsVerified,
        requiredSecrets: Object.entries(configuration.worker.env)
            .filter(([, binding]) => binding.type === 'secret')
            .map(([name]) => ({
                name,
                secretTypePresent: result.exact?.env[name]?.type === 'secret_text',
            })),
        sourceAnnotationMatchesHistoricalSource:
            result.exact?.sourceSha === input.historicalSourceSha,
        sourceProvenanceVerified: false, // API annotations alone do not attest artifact lineage.
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
