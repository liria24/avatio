import { resolveCloudflareDeliveryPreflight } from '../../scripts/cloudflareDeliveryPreflight'

const sha = 'a'.repeat(40)
const run = {
    id: 100,
    path: '.github/workflows/quality.yml',
    status: 'completed',
    conclusion: 'success',
    repository: { full_name: 'liria24/avatio' },
    head_repository: { full_name: 'liria24/avatio' },
    head_sha: sha,
    head_branch: 'main',
    event: 'push',
}
const input = { eventName: 'workflow_run', event: { workflow_run: { id: 100 } } }
const pr = {
    number: 354,
    state: 'open',
    head: { sha, repo: { full_name: 'liria24/avatio' } },
    base: { ref: 'development', repo: { full_name: 'liria24/avatio' } },
}

describe('secretless native delivery preflight', () => {
    it('checks fresh main quality without enabling any publisher', async () => {
        const read = vi
            .fn<(path: string) => Promise<unknown>>()
            .mockResolvedValueOnce(run)
            .mockResolvedValueOnce({ commit: { sha } })
        expect(await resolveCloudflareDeliveryPreflight(input, read)).toEqual({
            mode: 'production',
            isPreview: false,
            action: 'deploy',
            sourceSha: sha,
            activationVerified: false,
        })
        expect(read.mock.calls.map(([path]) => path)).toEqual([
            '/actions/runs/100',
            '/branches/main',
        ])
    })
    it('rejects an old successful run after the branch changes', async () => {
        const read = vi
            .fn<(path: string) => Promise<unknown>>()
            .mockResolvedValueOnce(run)
            .mockResolvedValueOnce({ commit: { sha: 'b'.repeat(40) } })
        await expect(resolveCloudflareDeliveryPreflight(input, read)).rejects.toThrow('superseded')
    })
    it.each([
        { conclusion: 'failure' },
        { status: 'in_progress' },
        { path: '.github/workflows/untrusted.yml' },
        { head_repository: { full_name: 'someone/fork' } },
        { repository: { full_name: 'someone/fork' } },
        { id: 101 },
    ])('rejects incomplete, unrelated or fork quality %j', async (override) => {
        await expect(
            resolveCloudflareDeliveryPreflight(input, async () => ({ ...run, ...override })),
        ).rejects.toThrow()
    })
    it('does not promote a feature-branch manual run to production', async () => {
        expect(
            await resolveCloudflareDeliveryPreflight(
                { eventName: 'workflow_dispatch', event: {}, qualityRunId: '100' },
                async () => ({ ...run, event: 'workflow_dispatch', head_branch: 'feature' }),
            ),
        ).toBeNull()
    })
    it('resolves an open same-repository PR from fresh API evidence', async () => {
        const read = vi
            .fn<(path: string) => Promise<unknown>>()
            .mockResolvedValueOnce({
                ...run,
                event: 'pull_request',
                pull_requests: [{ number: 354 }],
            })
            .mockResolvedValueOnce(pr)
        expect(await resolveCloudflareDeliveryPreflight(input, read)).toEqual({
            mode: 'pr-354',
            isPreview: true,
            action: 'deploy',
            sourceSha: sha,
            activationVerified: false,
        })
    })
    it.each([{ state: 'closed' }, { head: { ...pr.head, sha: 'b'.repeat(40) } }])(
        'rejects PR quality after a close or source change %j',
        async (override) => {
            const read = vi
                .fn<(path: string) => Promise<unknown>>()
                .mockResolvedValueOnce({
                    ...run,
                    event: 'pull_request',
                    pull_requests: [{ number: 354 }],
                })
                .mockResolvedValueOnce({ ...pr, ...override })
            await expect(resolveCloudflareDeliveryPreflight(input, read)).rejects.toThrow()
        },
    )
    it('rejects ambiguous PRs and does not select forks', async () => {
        await expect(
            resolveCloudflareDeliveryPreflight(input, async () => ({
                ...run,
                event: 'pull_request',
                pull_requests: [{ number: 354 }, { number: 355 }],
            })),
        ).rejects.toThrow('unambiguous')
        const read = vi
            .fn<(path: string) => Promise<unknown>>()
            .mockResolvedValueOnce({
                ...run,
                event: 'pull_request',
                pull_requests: [{ number: 354 }],
            })
            .mockResolvedValueOnce({
                ...pr,
                head: { ...pr.head, repo: { full_name: 'someone/fork' } },
            })
        expect(await resolveCloudflareDeliveryPreflight(input, read)).toBeNull()
    })
    it('selects cleanup only while a fresh same-repository PR is still closed', async () => {
        const close = { eventName: 'pull_request', event: { action: 'closed', number: 354 } }
        expect(
            await resolveCloudflareDeliveryPreflight(close, async () => ({
                ...pr,
                state: 'closed',
            })),
        ).toEqual({
            mode: 'pr-354',
            isPreview: true,
            action: 'cleanup',
            activationVerified: false,
        })
        expect(await resolveCloudflareDeliveryPreflight(close, async () => pr)).toBeNull()
        expect(
            await resolveCloudflareDeliveryPreflight(close, async () => ({
                ...pr,
                state: 'closed',
                head: { ...pr.head, repo: { full_name: 'someone/fork' } },
            })),
        ).toBeNull()
    })
    it('rejects malformed run identity before any request', async () => {
        const read = vi.fn<(path: string) => Promise<unknown>>()
        await expect(
            resolveCloudflareDeliveryPreflight(
                {
                    eventName: 'workflow_dispatch',
                    event: {},
                    qualityRunId: '../secrets',
                },
                read,
            ),
        ).rejects.toThrow()
        expect(read).not.toHaveBeenCalled()
    })
})
