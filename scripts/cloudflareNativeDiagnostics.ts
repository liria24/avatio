/** No provider body, arbitrary message or original exception is retained. */
export class NativeHttpError extends Error {
    readonly status: number | undefined
    constructor(status: number) {
        super('Deployment verification failed (api-http-failed); values omitted.')
        this.status =
            Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
    }
}
