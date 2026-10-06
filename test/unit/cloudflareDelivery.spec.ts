import { validateCloudflareDeliveryEvidence } from '../../config/cloudflareDelivery'

const sha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)
const production = {
    buildSucceeded: true,
    repository: 'liria24/avatio',
    sourceRepository: 'liria24/avatio',
    eventName: 'push' as const,
    ref: 'refs/heads/main',
    mode: 'production',
    sourceSha: sha,
    latestSourceSha: sha,
    trustedCodeSha: sha,
    checkedOutCodeSha: sha,
    trustedCodeRef: 'refs/heads/main',
    build: { sourceSha: sha, mode: 'production', isPreview: false, workerName: 'avatio' },
    state: { branch: null, commit: sha, dirty: false, ci: { ref: 'refs/heads/main', commit: sha } },
}

describe('future cf publisher provenance guards', () => {
    it('accepts matching immutable main output and trusted delivery code', () => {
        expect(validateCloudflareDeliveryEvidence(production)).toEqual({
            mode: 'production',
            isPreview: false,
            workerName: 'avatio',
        })
    })
    it.each([
        { repository: 'someone/fork' },
        { sourceRepository: 'someone/fork' },
        { latestSourceSha: otherSha },
        { buildSucceeded: false },
        { checkedOutCodeSha: otherSha },
        { trustedCodeRef: 'refs/pull/123/head' },
        { eventName: 'workflow_run' as const },
        { state: { ...production.state, dirty: true } },
        { build: { ...production.build, sourceSha: otherSha } },
        { build: { ...production.build, workerName: 'avatio-development' } },
        { build: { ...production.build, isPreview: true } },
    ])('rejects unsafe production provenance %j', (override) => {
        expect(() => validateCloudflareDeliveryEvidence({ ...production, ...override })).toThrow()
    })
    it('accepts a PR Preview built without credentials while executing separately trusted code', () => {
        const pr = {
            ...production,
            eventName: 'workflow_run' as const,
            mode: 'pr-123',
            ref: 'refs/pull/123/head',
            trustedCodeSha: otherSha,
            checkedOutCodeSha: otherSha,
            state: {
                ...production.state,
                commit: otherSha,
                ci: { ref: 'refs/heads/main', commit: otherSha },
            },
            build: { ...production.build, mode: 'pr-123', isPreview: true },
        }
        expect(validateCloudflareDeliveryEvidence(pr).isPreview).toBe(true)
        expect(() =>
            validateCloudflareDeliveryEvidence({ ...pr, build: production.build }),
        ).toThrow()
        expect(() =>
            validateCloudflareDeliveryEvidence({ ...pr, ref: 'refs/pull/124/head' }),
        ).toThrow()
        expect(() => validateCloudflareDeliveryEvidence({ ...pr, eventName: 'push' })).toThrow()
    })
})
