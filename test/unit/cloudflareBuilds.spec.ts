import { existsSync } from 'node:fs'

import {
    getCloudflareBuildsContext,
    installCloudflareDependencies,
} from '../../scripts/cloudflareBuilds'
import { requireCloudflareQuality } from '../../scripts/cloudflareQuality'

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: execute }))

const sourceSha = 'a'.repeat(40)
const buildId = '00000000-0000-4000-8000-000000000354'
const names = ['format', 'lint', 'lint:unused', 'typecheck', 'test', 'build']
const qualityRun = () => ({
    id: 354,
    path: '.github/workflows/quality.yml',
    event: 'push',
    head_branch: 'development',
    head_sha: sourceSha,
    repository: { full_name: 'liria24/avatio' },
    head_repository: { full_name: 'liria24/avatio' },
    status: 'completed',
    conclusion: 'success' as string | null,
})
const jobs = () => ({
    total_count: names.length,
    jobs: names.map((name) => ({ name, conclusion: 'success' })),
})
const fetchEvidence = (run = qualityRun(), checks = jobs()) =>
    vi.fn<typeof fetch>().mockImplementation(async (url, options) => {
        expect(options?.headers).toEqual({ accept: 'application/vnd.github+json' })
        expect(options?.redirect).toBe('error')
        const path = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
        if (path.includes('/jobs?')) return Response.json(checks)
        if (path.includes('actions/runs?'))
            return Response.json({ total_count: 1, workflow_runs: [run] })
        return Response.json(run)
    })

describe('credential-free dependency bootstrap', () => {
    it.each([false, true])(
        'uses a private clean environment and cleans up on failure=%s',
        (fail) => {
            let home = ''
            const outer = {
                PATH: '/synthetic/bin',
                CLOUDFLARE_API_TOKEN: 'synthetic-platform-token',
                GITHUB_TOKEN: 'synthetic-github-token',
                FUTURE_CREDENTIAL: 'synthetic-unknown-token',
                NODE_OPTIONS: '--require=/synthetic/untrusted.cjs',
                HOME: '/synthetic/platform-home',
            }
            const original = { ...outer }
            execute.mockImplementationOnce((command, args, options) => {
                expect(command).toBe(process.platform === 'win32' ? 'bun.exe' : 'bun')
                expect(args).toEqual([
                    'install',
                    '--frozen-lockfile',
                    '--ignore-scripts',
                    '--no-env-file',
                    '--registry',
                    'https://registry.npmjs.org',
                ])
                expect(options.env.CLOUDFLARE_API_TOKEN).toBeUndefined()
                expect(options.env.GITHUB_TOKEN).toBeUndefined()
                expect(options.env.FUTURE_CREDENTIAL).toBeUndefined()
                expect(options.env.NODE_OPTIONS).toBeUndefined()
                expect(options.env.PATH).toBe(outer.PATH)
                home = options.env.HOME
                expect(home).not.toBe(outer.HOME)
                expect(existsSync(home)).toBe(true)
                if (fail) throw new Error('Synthetic install failure')
                return ''
            })
            if (fail)
                expect(() => installCloudflareDependencies(outer)).toThrow(
                    'Synthetic install failure',
                )
            else installCloudflareDependencies(outer)
            expect(existsSync(home)).toBe(false)
            expect(outer).toEqual(original)
        },
    )
})

describe('Workers Builds source context', () => {
    const environment = {
        WORKERS_CI: '1',
        WORKERS_CI_BRANCH: 'development',
        WORKERS_CI_COMMIT_SHA: sourceSha,
        WORKERS_CI_BUILD_UUID: buildId,
    }
    const checkout = { sourceSha, clean: true }
    it.each([
        ['main', 'production'],
        ['development', 'development'],
    ])('selects %s from exact clean platform evidence', (branch, stage) => {
        expect(
            getCloudflareBuildsContext({ ...environment, WORKERS_CI_BRANCH: branch }, checkout),
        ).toEqual({ stage, sourceSha })
    })
    it.each([
        { WORKERS_CI: '' },
        { WORKERS_CI_BRANCH: 'feature/example' },
        { WORKERS_CI_BRANCH: 'refs/pull/354/merge' },
        { WORKERS_CI_COMMIT_SHA: 'b'.repeat(40) },
        { WORKERS_CI_COMMIT_SHA: '' },
        { WORKERS_CI_BUILD_UUID: '-'.repeat(36) },
    ])('rejects unsupported or mismatched context %j', (override) => {
        expect(() =>
            getCloudflareBuildsContext({ ...environment, ...override }, checkout),
        ).toThrow()
    })
    it('rejects tracked changes independently of platform evidence', () => {
        expect(() =>
            getCloudflareBuildsContext(environment, { ...checkout, clean: false }),
        ).toThrow()
    })
})

describe('exact successful public branch quality', () => {
    it.each(['development', 'production'])(
        'requires the matching %s push and all six checks',
        async (stage) => {
            const run = qualityRun()
            run.head_branch = stage === 'production' ? 'main' : 'development'
            const fetcher = fetchEvidence(run)
            await expect(requireCloudflareQuality(stage, sourceSha, { fetcher })).resolves.toEqual({
                qualityRunId: run.id,
                sourceSha,
            })
            expect(fetcher).toHaveBeenCalledTimes(2)
        },
    )
    it.each([
        { event: 'pull_request' },
        { head_branch: 'main' },
        { head_sha: 'b'.repeat(40) },
        { repository: { full_name: 'fork/avatio' } },
        { head_repository: { full_name: 'fork/avatio' } },
        { conclusion: 'failure' },
        { conclusion: 'cancelled' },
        { status: 'unknown' },
        { id: 0 },
    ])('rejects unrelated or unsuccessful evidence %j', async (override) => {
        await expect(
            requireCloudflareQuality('development', sourceSha, {
                fetcher: fetchEvidence({ ...qualityRun(), ...override }),
                timeoutMs: 0,
            }),
        ).rejects.toThrow()
    })
    it.each(['missing', 'duplicate', 'failed', 'incomplete'])(
        'rejects %s required checks',
        async (kind) => {
            const checks = jobs()
            if (kind === 'missing') checks.jobs.pop()
            if (kind === 'duplicate') checks.jobs.push({ ...checks.jobs[0]! })
            if (kind === 'failed') checks.jobs[0]!.conclusion = 'failure'
            if (kind !== 'incomplete') checks.total_count = checks.jobs.length
            else checks.total_count++
            await expect(
                requireCloudflareQuality('development', sourceSha, {
                    fetcher: fetchEvidence(qualityRun(), checks),
                }),
            ).rejects.toThrow()
        },
    )
    it('waits for the matching pending run to succeed', async () => {
        const run = { ...qualityRun(), status: 'in_progress', conclusion: null }
        const wait = vi.fn(async () => {
            Object.assign(run, { status: 'completed', conclusion: 'success' })
        })
        await expect(
            requireCloudflareQuality('development', sourceSha, {
                fetcher: fetchEvidence(run),
                wait,
            }),
        ).resolves.toEqual({ qualityRunId: run.id, sourceSha })
        expect(wait).toHaveBeenCalledOnce()
    })
    it('stops pending quality at the readiness deadline', async () => {
        let time = 0
        await expect(
            requireCloudflareQuality('development', sourceSha, {
                fetcher: fetchEvidence({ ...qualityRun(), status: 'in_progress' }),
                now: () => time,
                wait: async () => {
                    time += 10
                },
                timeoutMs: 10,
            }),
        ).rejects.toThrow(/deadline/)
    })
    it('fails on provider errors without exposing response details', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response('private details', { status: 403 }))
        await expect(
            requireCloudflareQuality('development', sourceSha, { fetcher }),
        ).rejects.toThrow('Fresh public GitHub quality evidence unavailable.')
    })
    it('rejects incomplete listings and a newer failure over an older success', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            Response.json({
                total_count: 2,
                workflow_runs: [qualityRun(), { ...qualityRun(), id: 355, conclusion: 'failure' }],
            }),
        )
        await expect(
            requireCloudflareQuality('development', sourceSha, { fetcher }),
        ).rejects.toThrow('Branch quality did not succeed.')
        fetcher.mockResolvedValue(Response.json({ total_count: 3, workflow_runs: [qualityRun()] }))
        await expect(
            requireCloudflareQuality('development', sourceSha, { fetcher }),
        ).rejects.toThrow(/Complete/)
    })

    it('selects the target branch when main and development share a source SHA', async () => {
        const run = qualityRun()
        const other = { ...run, id: run.id + 1, head_branch: 'main' }
        const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
            const path = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
            if (path.includes('/jobs?')) {
                expect(path).toContain(`/actions/runs/${run.id}/jobs`)
                return Response.json(jobs())
            }
            return Response.json({ total_count: 2, workflow_runs: [run, other] })
        })
        await expect(
            requireCloudflareQuality('development', sourceSha, { fetcher }),
        ).resolves.toEqual({
            qualityRunId: run.id,
            sourceSha,
        })
    })
})
