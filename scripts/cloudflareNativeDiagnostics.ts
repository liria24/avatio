/** Static phases only. Neither thrown messages nor CLI/API bodies reach Actions diagnostics. */
export type NativePhase =
    | 'source-selection'
    | 'protected-approval'
    | 'artifact-validation'
    | 'publish-plan'
    | 'preview-base'
    | 'resource-inspection'
    | 'migration-ledger'
    | 'migration-apply'
    | 'migration-postflight'
    | 'publication-postflight'
    | 'preview-publish'
    | 'cli-receipt'
    | 'preview-parent'
    | 'existing-preview'
    | 'deployment-read'
    | 'binding-verification'
    | 'immutable-http'
    | 'inspection-inputs'
    | 'inspection-resources'
    | 'inspection-deployment'
    | 'inspection-metadata-collection'
    | 'inspection-contract-audit'
    | 'inspection-latest-read'
    | 'inspection-latest-identity'
    | 'inspection-exact-read'
    | 'inspection-exact-identity'
    | 'preview-api-response'
    | 'preview-endpoint-association'
    | 'inspection-ledger'
    | 'inspection-http'
    | 'inspection-postflight'

type NativeFailureCode =
    | 'operation-failed'
    | 'api-response-scope-mismatch'
    | 'preview-parent-changed'
    | 'preview-deployment-receipt-mismatch'
    | 'api-transport-failed'
    | 'api-http-failed'
    | 'api-json-invalid'
    | 'api-envelope-shape'
    | 'api-envelope-rejected'
    | 'api-result-missing'
    | 'api-deployment-shape'
    | 'preview-parent-id-mismatch'
    | 'preview-name-mismatch'
    | 'preview-deployment-id-invalid'
    | 'preview-exact-id-mismatch'
    | 'preview-url-contract-mismatch'
    | 'preview-bindings-mismatch'
    | 'preview-source-mismatch'

type NativeDiagnostic = {
    phase: NativePhase
    outcome: 'started' | 'verified' | 'failed'
    code?: NativeFailureCode
    evidence?: {
        previewPresent?: boolean
        deploymentPresent?: boolean
        parentMatches?: boolean
        previewParentStable?: boolean
        endpointAssociationVerified?: boolean
        sourceAnnotationPresent?: boolean
        sourceAnnotationMatches?: boolean
        requiredSecretTypesPresent?: boolean
        requiredSecrets?: {
            name: 'BETTER_AUTH_SECRET' | 'NUXT_BETTER_AUTH_SECRET' | 'TWITTER_CLIENT_SECRET'
            secretTypePresent: boolean
        }[]
        bindingsVerified?: boolean
        cliExitedNormally?: boolean
        cliJsonAvailable?: boolean
        contractAudit?: ReturnType<
            typeof import('./cloudflarePreviewMetadata.ts').inspectCloudflarePreviewMetadata
        > & {
            issues: (
                | 'url-contract-mismatch'
                | 'bindings-mismatch'
                | 'source-mismatch'
                | 'reviewed-url-mismatch'
            )[]
        }
        responseShape?: {
            httpResponseReceived?: boolean
            jsonParsed?: boolean
            envelopeObject?: boolean
            successPresent?: boolean
            successBoolean?: boolean
            successTrue?: boolean
            resultPresent?: boolean
            resultObject?: boolean
            resultArray?: boolean
            resultNull?: boolean
            deploymentObject?: boolean
            idPresent?: boolean
            idString?: boolean
            idValidIdentifier?: boolean
            previewIdPresent?: boolean
            previewIdString?: boolean
            previewIdValidIdentifier?: boolean
            previewNamePresent?: boolean
            previewNameString?: boolean
            urlsPresent?: boolean
            urlsArray?: boolean
            urlsNonEmpty?: boolean
            urlsStrings?: boolean
            envPresent?: boolean
            envObject?: boolean
            annotationsPresent?: boolean
            annotationsObject?: boolean
        }
        providerError?: {
            jsonParsed: boolean
            bodyWithinLimit: boolean
            codes: number[]
            classification:
                | 'preview-not-found'
                | 'deployment-not-found'
                | 'deployment-not-patchable'
                | 'unclassified'
        }
        previewNameMatches?: boolean
        deploymentIdValid?: boolean
        exactIdMatches?: boolean
    }
    httpStatus?: number
}
export type NativeReporter = (diagnostic: NativeDiagnostic) => void

/** Closed error categories and bounded projections only; original failures stay in non-enumerable cause. */
export class NativeDiagnosticError extends Error {
    readonly code: NativeFailureCode
    readonly evidence: NonNullable<NativeDiagnostic['evidence']>
    readonly httpStatus: number | undefined
    constructor(
        code: NativeFailureCode,
        evidence: NonNullable<NativeDiagnostic['evidence']> = {},
        cause?: unknown,
        httpStatus?: number,
    ) {
        super(`Native verification failed (${code}); values omitted.`, { cause })
        this.code = code
        this.evidence = evidence
        this.httpStatus = httpStatus
    }
}

/** HTTP status is explicitly typed at the transport boundary, never extracted from error text. */
export class NativeHttpError extends Error {
    readonly status: number
    readonly providerError: NonNullable<NativeDiagnostic['evidence']>['providerError']
    constructor(
        status: number,
        providerError?: NonNullable<NativeDiagnostic['evidence']>['providerError'],
    ) {
        super('Cloudflare HTTP operation failed; response omitted.')
        this.status = status
        this.providerError = providerError
    }
}

export const nativePhase = async <T>(
    phase: NativePhase,
    report: NativeReporter | undefined,
    operation: () => Promise<T> | T,
): Promise<T> => {
    report?.({ phase, outcome: 'started' })
    try {
        const value = await operation()
        report?.({ phase, outcome: 'verified' })
        return value
    } catch (error) {
        report?.({
            phase,
            outcome: 'failed',
            code:
                error instanceof NativeDiagnosticError
                    ? error.code
                    : error instanceof NativeHttpError
                      ? 'api-http-failed'
                      : 'operation-failed',
            ...(error instanceof NativeDiagnosticError
                ? { evidence: error.evidence }
                : error instanceof NativeHttpError
                  ? {
                        evidence: {
                            responseShape: {
                                httpResponseReceived: true,
                                jsonParsed: error.providerError?.jsonParsed ?? false,
                            },
                            ...(error.providerError ? { providerError: error.providerError } : {}),
                        },
                    }
                  : {}),
            ...(() => {
                const status =
                    error instanceof NativeHttpError
                        ? error.status
                        : error instanceof NativeDiagnosticError
                          ? error.httpStatus
                          : undefined
                return status !== undefined &&
                    Number.isInteger(status) &&
                    status >= 100 &&
                    status <= 599
                    ? { httpStatus: status }
                    : {}
            })(),
        })
        throw error
    }
}
