import { alchemyCommand, validateDeployment } from '../../config/deployment'
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
    it('requires a separate, interactive adoption command', () => {
        expect(alchemyCommand('deploy', 'production')).toEqual([
            'bunx',
            'alchemy',
            'deploy',
            '--stage',
            'production',
            '--yes',
        ])
        expect(alchemyCommand('adopt', 'production')).toEqual([
            'bunx',
            'alchemy',
            'deploy',
            '--stage',
            'production',
            '--adopt',
        ])
    })
})
