import { getCloudflareDeliveryTarget, validateDeployment } from '../../config/deployment'
import { getStageConfig } from '../../config/environment'

const cleanMain = { branch: 'main', commit: 'abc123', dirty: false }

describe('production deployment policy', () => {
    it('allows a clean main checkout and validates both stage configurations without secrets', () => {
        expect(() => validateDeployment('production', cleanMain)).not.toThrow()
        expect(getStageConfig('production').production).toBe(true)
        expect(getStageConfig('development').production).toBe(false)
    })
    it.each([
        { branch: 'alchemy' },
        { branch: null },
        { dirty: true },
        { ci: {} },
        { ci: { ref: 'refs/pull/1/merge', commit: 'abc123' } },
        { ci: { branch: 'main', commit: 'wrong' } },
        { ci: { branch: 'main' } },
        { ci: { branch: 'alchemy', ref: 'refs/heads/main', commit: 'abc123' } },
    ])('rejects unsafe deployment state %j', (override) => {
        expect(() => validateDeployment('production', { ...cleanMain, ...override })).toThrow()
    })
    it('validates CI provenance against the actual checkout, including detached CI checkouts', () => {
        expect(() =>
            validateDeployment('production', {
                ...cleanMain,
                branch: null,
                ci: { ref: 'refs/heads/main', commit: cleanMain.commit },
            }),
        ).not.toThrow()
        expect(() =>
            validateDeployment('production', {
                ...cleanMain,
                ci: { branch: 'main', commit: cleanMain.commit },
            }),
        ).not.toThrow()
    })
    it('leaves local development deploys unaffected', () => {
        expect(() =>
            validateDeployment('development', { branch: 'alchemy', dirty: true, commit: '' }),
        ).not.toThrow()
    })
})

describe('future GitHub delivery targets (validation only)', () => {
    const input = {
        eventName: 'push',
        event: {},
        repository: 'liria24/avatio',
        ref: 'refs/heads/main',
        state: { ...cleanMain, ci: { ref: 'refs/heads/main', commit: cleanMain.commit } },
    }
    const pr = (action: string, repository = input.repository) => ({
        action,
        number: 354,
        pull_request: {
            head: { repo: { full_name: repository } },
            base: { ref: 'main', repo: { full_name: input.repository } },
        },
    })

    it('maps protected main and development pushes without changing the Worker identity', () => {
        expect(getCloudflareDeliveryTarget(input)).toEqual({
            mode: 'production',
            isPreview: false,
            action: 'deploy',
        })
        expect(getCloudflareDeliveryTarget({ ...input, ref: 'refs/heads/development' })).toEqual({
            mode: 'development',
            isPreview: true,
            action: 'deploy',
        })
        expect(() =>
            getCloudflareDeliveryTarget({ ...input, state: { ...input.state, dirty: true } }),
        ).toThrow()
        expect(() =>
            getCloudflareDeliveryTarget({ ...input, state: { ...input.state, commit: 'wrong' } }),
        ).toThrow()
        expect(getCloudflareDeliveryTarget({ ...input, ref: 'refs/heads/feature' })).toBeNull()
    })

    it.each(['opened', 'synchronize', 'reopened', 'closed'])(
        'maps a same-repository PR %s to its stable name',
        (action) => {
            expect(
                getCloudflareDeliveryTarget({
                    ...input,
                    eventName: 'pull_request',
                    event: pr(action),
                }),
            ).toEqual({
                mode: 'pr-354',
                isPreview: true,
                action: action === 'closed' ? 'cleanup' : 'deploy',
            })
        },
    )

    it('excludes fork, malformed, and privileged PR events', () => {
        expect(
            getCloudflareDeliveryTarget({
                ...input,
                eventName: 'pull_request',
                event: pr('opened', 'someone/fork'),
            }),
        ).toBeNull()
        expect(
            getCloudflareDeliveryTarget({
                ...input,
                eventName: 'pull_request',
                event: { ...pr('closed'), number: 0 },
            }),
        ).toBeNull()
        expect(
            getCloudflareDeliveryTarget({
                ...input,
                eventName: 'pull_request_target',
                event: pr('closed'),
            }),
        ).toBeNull()
        expect(
            getCloudflareDeliveryTarget({
                ...input,
                eventName: 'workflow_dispatch',
                ref: 'refs/heads/feature',
            }),
        ).toBeNull()
    })
})
