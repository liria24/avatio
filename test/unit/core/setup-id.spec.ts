import { generateAvailableSetupId, setupPath } from '@avatio/core/setups'

describe('Setup ID policy', () => {
    const policy = { isReserved: (id: string) => id.toLowerCase() === 'settings' }

    it('uses the legacy path for a historical route collision', () => {
        expect(setupPath('settings', policy)).toBe('/setup/settings')
        expect(setupPath('existing', policy)).toBe('/existing')
    })

    it('rejects reserved and existing IDs during generation', async () => {
        const candidates = ['settings', 'existing', 'new-id']
        const repository = { exists: vi.fn(async (id: string) => id === 'existing') }

        await expect(
            generateAvailableSetupId({
                policy,
                repository,
                generate: () => candidates.shift() ?? 'unused',
            }),
        ).resolves.toBe('new-id')
    })
})
