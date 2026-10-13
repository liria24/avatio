import { parseAvatioStage } from '../config/environment.ts'

interface QualityRun {
    id: number
    path: string
    event: string
    head_branch: string
    head_sha: string
    repository: { full_name: string }
    head_repository: { full_name: string }
    status: string
    conclusion: string | null
}

/** Public repository evidence only; no GitHub credential or publisher is added. */
export const requireCloudflareQuality = async (
    mode: string,
    sourceSha: string,
    options: {
        fetcher?: typeof fetch
        now?: () => number
        wait?: () => Promise<void>
        timeoutMs?: number
    } = {},
) => {
    const stage = parseAvatioStage(mode)
    const branch = stage === 'production' ? 'main' : 'development'
    if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Immutable quality source required.')
    const fetcher = options.fetcher ?? fetch
    const now = options.now ?? Date.now
    const wait = options.wait ?? (() => new Promise<void>((done) => setTimeout(done, 60_000)))
    const deadline = now() + (options.timeoutMs ?? 8 * 60_000)
    const get = async <T>(path: string): Promise<T> => {
        const response = await fetcher(`https://api.github.com/repos/liria24/avatio/${path}`, {
            headers: { accept: 'application/vnd.github+json' },
            redirect: 'error',
            signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) throw new Error('Fresh public GitHub quality evidence unavailable.')
        return (await response.json()) as T
    }
    let run: QualityRun | undefined
    while (true) {
        if (!run) {
            const listing = await get<{ workflow_runs: QualityRun[]; total_count: number }>(
                `actions/runs?head_sha=${sourceSha}&event=push&per_page=100`,
            )
            if (
                !Array.isArray(listing.workflow_runs) ||
                listing.workflow_runs.length !== listing.total_count
            )
                throw new Error('Complete branch quality evidence required.')
            run = listing.workflow_runs
                .filter(
                    (candidate) =>
                        candidate.path === '.github/workflows/quality.yml' &&
                        candidate.head_branch === branch &&
                        candidate.event === 'push',
                )
                .sort((a, b) => b.id - a.id)[0]
        }
        if (run) {
            if (
                !Number.isSafeInteger(run.id) ||
                run.id < 1 ||
                run.path !== '.github/workflows/quality.yml' ||
                run.event !== 'push' ||
                run.head_branch !== branch ||
                run.head_sha !== sourceSha ||
                run.repository?.full_name !== 'liria24/avatio' ||
                run.head_repository?.full_name !== 'liria24/avatio'
            )
                throw new Error('Quality source, branch or repository differs from review.')
            if (run.status === 'completed') {
                if (run.conclusion !== 'success') throw new Error('Branch quality did not succeed.')
                const jobs = await get<{
                    jobs: { name: string; conclusion: string | null }[]
                    total_count: number
                }>(`actions/runs/${run.id}/jobs?per_page=100`)
                if (!Array.isArray(jobs.jobs) || jobs.jobs.length !== jobs.total_count)
                    throw new Error('Complete successful quality jobs required.')
                for (const name of [
                    'format',
                    'lint',
                    'lint:unused',
                    'typecheck',
                    'test',
                    'build',
                ]) {
                    const matches = jobs.jobs.filter((job) => job.name === name)
                    if (matches.length !== 1 || matches[0]?.conclusion !== 'success')
                        throw new Error('Every required branch quality check must succeed once.')
                }
                return { qualityRunId: run.id, sourceSha }
            }
            if (!['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(run.status))
                throw new Error('Unexpected branch quality state.')
        }
        if (now() >= deadline) throw new Error('Branch quality readiness deadline exceeded.')
        await wait()
        if (run) run = await get<QualityRun>(`actions/runs/${run.id}`)
    }
}
