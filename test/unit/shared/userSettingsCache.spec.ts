import { describe, expect, it, vi } from 'vitest'

import { getUserSettingsForSession } from '../../../shared/utils/userSettingsCache'

describe('user settings session cache', () => {
    it('does not write to KV when the settings cache is hit', async () => {
        const cache = {
            getItem: vi.fn().mockResolvedValue({
                updatedAt: '2026-08-01T00:00:00.000Z',
                showPrivateSetups: false,
                showNSFW: true,
            }),
            setItem: vi.fn(),
        }
        const loadFromDatabase = vi.fn()

        const settings = await getUserSettingsForSession(cache, 'user-id', 300, loadFromDatabase)

        expect(settings).toMatchObject({
            showPrivateSetups: false,
            showNSFW: true,
        })
        expect(settings.updatedAt).toBeInstanceOf(Date)
        expect(loadFromDatabase).not.toHaveBeenCalled()
        expect(cache.setItem).not.toHaveBeenCalled()
    })

    it('stores a database miss with the configured session cache TTL', async () => {
        const cache = {
            getItem: vi.fn().mockResolvedValue(null),
            setItem: vi.fn().mockResolvedValue(undefined),
        }

        await getUserSettingsForSession(cache, 'user-id', 300, async () => ({
            updatedAt: null,
            showPrivateSetups: true,
            showNSFW: false,
        }))

        expect(cache.setItem).toHaveBeenCalledWith(
            'user-settings:user-id',
            expect.objectContaining({ showPrivateSetups: true }),
            { ttl: 300 },
        )
    })
})
