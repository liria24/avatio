import { readFileSync } from 'node:fs'

import { getCloudflareDeliveryTarget } from '../config/deployment.ts'

const repository = 'liria24/avatio'
type GithubRead = (path: string) => Promise<unknown>
const object = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
const runIdentifier = (value: unknown) => {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value
}

/** Read-only source selection for a future publisher. No artifact or Cloudflare access. */
export const resolveCloudflareDeliveryPreflight = async (
    input: { eventName: string; event: unknown; qualityRunId?: string },
    read: GithubRead,
) => {
    const event = object(input.event)
    const prTarget = (pr: Record<string, unknown>, number: number, action: string) =>
        getCloudflareDeliveryTarget({
            eventName: 'pull_request',
            event: { action, number, pull_request: pr },
            repository,
            ref: '',
            state: { branch: null, commit: '', dirty: false },
        })
    if (input.eventName === 'pull_request') {
        const number = event.number
        if (
            event.action !== 'closed' ||
            typeof number !== 'number' ||
            !Number.isSafeInteger(number) ||
            number < 1
        )
            return null
        const pr = object(await read(`/pulls/${number}`))
        if (pr.state !== 'closed' || pr.number !== number) return null
        const target = prTarget(pr, number, 'closed')
        return target ? { ...target, activationVerified: false as const } : null
    }
    const runId = runIdentifier(
        input.eventName === 'workflow_run'
            ? object(event.workflow_run).id
            : input.eventName === 'workflow_dispatch'
              ? input.qualityRunId
              : undefined,
    )
    if (!runId) throw new Error('An exact quality run ID is required.')
    const run = object(await read(`/actions/runs/${runId}`))
    if (
        runIdentifier(run.id) !== runId ||
        run.path !== '.github/workflows/quality.yml' ||
        run.status !== 'completed' ||
        run.conclusion !== 'success' ||
        object(run.repository).full_name !== repository ||
        object(run.head_repository).full_name !== repository ||
        typeof run.head_sha !== 'string' ||
        !/^[a-f0-9]{40}$/.test(run.head_sha)
    )
        throw new Error('Only successful quality from this repository can select a native target.')
    if (run.event === 'pull_request') {
        if (!Array.isArray(run.pull_requests) || run.pull_requests.length !== 1)
            throw new Error('An unambiguous PR identity is required.')
        const number = object(run.pull_requests[0]).number
        if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1)
            throw new Error('Invalid PR identity.')
        const pr = object(await read(`/pulls/${number}`))
        if (pr.number !== number || pr.state !== 'open' || object(pr.head).sha !== run.head_sha)
            throw new Error('The PR closed, reopened or changed since this quality run.')
        const target = prTarget(pr, number, 'synchronize')
        return target
            ? { ...target, sourceSha: run.head_sha, activationVerified: false as const }
            : null
    }
    if (
        typeof run.event !== 'string' ||
        typeof run.head_branch !== 'string' ||
        !['push', 'workflow_dispatch'].includes(run.event) ||
        !['main', 'development'].includes(run.head_branch)
    )
        return null
    const branch = run.head_branch
    const latest = object(await read(`/branches/${branch}`))
    if (object(latest.commit).sha !== run.head_sha)
        throw new Error('Refusing superseded quality output.')
    const ref = `refs/heads/${branch}`
    const target = getCloudflareDeliveryTarget({
        eventName: 'push',
        event: {},
        repository,
        ref,
        state: {
            branch: null,
            commit: run.head_sha,
            dirty: false,
            ci: { ref, commit: run.head_sha },
        },
    })
    return target
        ? { ...target, sourceSha: run.head_sha, activationVerified: false as const }
        : null
}

if (import.meta.main) {
    try {
        const plan = await resolveCloudflareDeliveryPreflight(
            {
                eventName: process.env.GITHUB_EVENT_NAME ?? '',
                event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8')),
                qualityRunId: process.env.QUALITY_RUN_ID,
            },
            async (path) => {
                const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
                    method: 'GET',
                    redirect: 'error',
                    signal: AbortSignal.timeout(10_000),
                    headers: {
                        accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                })
                if (!response.ok) throw new Error('GitHub source evidence is unavailable.')
                return response.json()
            },
        )
        console.info(JSON.stringify({ plan, publisherEnabled: false, cloudflareOperations: 0 }))
    } catch {
        console.error(
            'Native delivery preflight failed closed; no deployment or cleanup is enabled.',
        )
        process.exitCode = 1
    }
}
