import { execFileSync } from 'node:child_process'

import { NativeHttpError, nativePhase } from '../../scripts/cloudflareNativeDiagnostics'

describe('development inspection diagnostics', () => {
    it('loads the inspection entry point under plain Node TypeScript stripping without credentials', () => {
        expect(() =>
            execFileSync(
                process.execPath,
                [
                    '--input-type=module',
                    '-e',
                    "await import('./scripts/cloudflareInspectDevelopmentCi.ts');",
                ],
                {
                    cwd: process.cwd(),
                    env: { PATH: process.env.PATH ?? '', CI: 'true' },
                    stdio: 'pipe',
                },
            ),
        ).not.toThrow()
    })
    it.each([new Error('HTTP 403 synthetic-secret'), { status: 403, token: 'secret' }, 'secret'])(
        'sanitizes arbitrary failures and never derives status from their text or fields',
        async (error) => {
            const report = vi.fn()
            await expect(
                nativePhase('inspection-resources', report, () => {
                    throw error
                }),
            ).rejects.toThrow(/operation-failed/)
            expect(report.mock.calls.flat()).toEqual([
                { phase: 'inspection-resources', outcome: 'started' },
                { phase: 'inspection-resources', outcome: 'failed', code: 'operation-failed' },
            ])
            expect(JSON.stringify(report.mock.calls)).not.toContain('secret')
        },
    )
    it.each([403, 999])(
        'reports only a valid explicitly typed HTTP status (%s)',
        async (status) => {
            const report = vi.fn()
            await nativePhase('inspection-resources', report, () => {
                throw new NativeHttpError(status)
            }).catch(() => {})
            expect(report.mock.lastCall?.[0]).toEqual({
                phase: 'inspection-resources',
                outcome: 'failed',
                code: 'api-http-failed',
                ...(status === 403 ? { httpStatus: 403 } : {}),
            })
        },
    )
})
