export type PermanentItemResolutionReason =
    | 'provider-not-found'
    | 'provider-gone'
    | 'policy-rejected'

export class PermanentItemResolutionError extends Error {
    readonly statusCode = 404

    constructor(
        message: string,
        readonly reason: PermanentItemResolutionReason,
    ) {
        super(message)
        this.name = 'PermanentItemResolutionError'
    }
}
