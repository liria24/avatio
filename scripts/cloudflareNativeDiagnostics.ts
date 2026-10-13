/** Development inspection diagnostics contain only fixed codes and typed HTTP statuses. */
export type NativePhase =
    | 'inspection-inputs'
    | 'inspection-resources'
    | 'inspection-ledger'
    | 'inspection-deployment'
    | 'inspection-http'
    | 'inspection-postflight'

export type NativeFailureCode =
    | 'operation-failed'
    | 'api-transport-failed'
    | 'api-http-failed'
    | 'api-response-scope-mismatch'
    | 'api-response-invalid'
    | 'preview-parent-mismatch'
    | 'preview-parent-changed'
    | 'preview-deployment-mismatch'
    | 'preview-bindings-mismatch'
    | 'preview-source-mismatch'
    | 'preview-url-mismatch'

export type NativeReporter = (diagnostic: {
    phase: NativePhase
    outcome: 'started' | 'verified' | 'failed'
    code?: NativeFailureCode
    httpStatus?: number
    bindingsVerified?: boolean
    unexpectedBindingCount?: number
    requiredSecrets?: { name: string; type: string; secretTypePresent: boolean }[]
}) => void

/** No provider body, arbitrary message or original exception is retained. */
export class NativeDiagnosticError extends Error {
    readonly code: NativeFailureCode
    constructor(code: NativeFailureCode) {
        super(`Development inspection failed (${code}); values omitted.`)
        this.code = code
    }
}

export class NativeHttpError extends NativeDiagnosticError {
    readonly status: number | undefined
    constructor(status: number) {
        super('api-http-failed')
        this.status =
            Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
    }
}

export const nativePhase = async <T>(
    phase: NativePhase,
    report: NativeReporter | undefined,
    operation: () => Promise<T> | T,
): Promise<T> => {
    report?.({ phase, outcome: 'started' })
    try {
        const result = await operation()
        report?.({ phase, outcome: 'verified' })
        return result
    } catch (cause) {
        const error =
            cause instanceof NativeDiagnosticError
                ? cause
                : new NativeDiagnosticError('operation-failed')
        report?.({
            phase,
            outcome: 'failed',
            code: error.code,
            ...(error instanceof NativeHttpError && error.status !== undefined
                ? { httpStatus: error.status }
                : {}),
        })
        throw error
    }
}
