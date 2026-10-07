import { execFileSync } from 'node:child_process'

import { NativeHttpError, nativePhase } from '../../scripts/cloudflareNativeDiagnostics'

describe('native phase diagnostics', () => {
    it('loads trusted executable modules under plain Node TypeScript stripping without credentials', () => {
        expect(() =>
            execFileSync(
                process.execPath,
                [
                    '--input-type=module',
                    '-e',
                    "await import('./scripts/cloudflareNativeDiagnostics.ts'); await import('./scripts/cloudflareNativeCi.ts'); await import('./scripts/cloudflareInspectDevelopmentCi.ts');",
                ],
                {
                    cwd: process.cwd(),
                    env: { PATH: process.env.PATH ?? '', CI: 'true' },
                    stdio: 'pipe',
                },
            ),
        ).not.toThrow()
    })

    it('reports only static phase/error codes and typed status, retaining the original failure privately', async () => {
        const report = vi.fn()
        const secret = 'synthetic-signing-secret/raw-cli-token'
        const error = new Error(secret)
        await expect(
            nativePhase('preview-base', report, () => {
                throw error
            }),
        ).rejects.toBe(error)
        expect(report.mock.calls.flat()).toEqual([
            { phase: 'preview-base', outcome: 'started' },
            { phase: 'preview-base', outcome: 'failed', code: 'operation-failed' },
        ])
        expect(JSON.stringify(report.mock.calls)).not.toContain(secret)
    })
    it('never extracts a status or other data from arbitrary thrown messages', async () => {
        for (const error of [
            new Error('HTTP 403 synthetic-secret'),
            { status: 403, token: 'secret' },
            'secret',
        ]) {
            const report = vi.fn()
            await nativePhase('preview-parent', report, () => {
                throw error
            }).catch(() => {})
            expect(report.mock.lastCall?.[0]).toEqual({
                phase: 'preview-parent',
                outcome: 'failed',
                code: 'operation-failed',
            })
        }
    })
    it('reports a bounded transport status without response data', async () => {
        const report = vi.fn()
        await nativePhase('preview-base', report, () => {
            throw new NativeHttpError(403)
        }).catch(() => {})
        expect(report.mock.lastCall?.[0]).toEqual({
            phase: 'preview-base',
            outcome: 'failed',
            code: 'api-http-failed',
            evidence: { responseShape: { httpResponseReceived: true, jsonParsed: false } },
            httpStatus: 403,
        })
    })
})
