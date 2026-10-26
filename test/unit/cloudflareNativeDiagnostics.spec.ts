import { NativeHttpError } from '../../scripts/cloudflareNativeDiagnostics'

describe('deployment HTTP diagnostics', () => {
    it.each([403, 999])('reports only a valid explicitly typed HTTP status (%s)', (status) => {
        const error = new NativeHttpError(status)
        expect(error.status).toBe(status === 403 ? status : undefined)
        expect(error.message).toBe(
            'Deployment verification failed (api-http-failed); values omitted.',
        )
    })
})
