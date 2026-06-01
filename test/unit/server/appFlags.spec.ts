import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const flagsStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
}
const cacheStorage = {
    del: vi.fn(),
}

beforeEach(() => {
    flagsStorage.getItem.mockReset()
    flagsStorage.setItem.mockReset()
    cacheStorage.del.mockReset()
    vi.stubGlobal('APP_FLAGS_CACHE_TTL', 5)
    vi.stubGlobal('defineCachedFunction', (fn: () => Promise<unknown>) => fn)
    vi.stubGlobal(
        'itemCategorySchema',
        z.enum(['avatar', 'hair', 'clothing', 'accessory', 'texture', 'shader', 'tool', 'other']),
    )
    vi.stubGlobal('useStorage', (name: string) => (name === 'flags' ? flagsStorage : cacheStorage))
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('appFlags', () => {
    it('returns defaults when no stored config exists', async () => {
        flagsStorage.getItem.mockResolvedValue(null)

        const { getAppFlags } = await import('../../../server/utils/appFlags')

        await expect(getAppFlags()).resolves.toEqual({
            allowedBoothCategoryId: [],
            forceUpdateItem: false,
            isMaintenance: false,
            specificItemCategories: {
                booth: {},
                github: {},
            },
        })
    })

    it('merges a partial patch and deletes the cached value', async () => {
        const stored = {
            allowedBoothCategoryId: [208],
            forceUpdateItem: false,
            isMaintenance: false,
            specificItemCategories: {
                booth: { '123': 'avatar' },
                github: {},
            },
        } as const
        flagsStorage.getItem.mockResolvedValue(stored)

        const { appFlagsSchema, getAppFlags, updateAppFlags } =
            await import('../../../server/utils/appFlags')

        expect(appFlagsSchema.parse(stored)).toEqual(stored)
        await expect(getAppFlags()).resolves.toEqual(stored)
        await expect(updateAppFlags({ isMaintenance: true })).resolves.toEqual({
            allowedBoothCategoryId: [208],
            forceUpdateItem: false,
            isMaintenance: true,
            specificItemCategories: {
                booth: { '123': 'avatar' },
                github: {},
            },
        })
        expect(flagsStorage.setItem).toHaveBeenCalledWith('app', {
            allowedBoothCategoryId: [208],
            forceUpdateItem: false,
            isMaintenance: true,
            specificItemCategories: {
                booth: { '123': 'avatar' },
                github: {},
            },
        })
        expect(cacheStorage.del).toHaveBeenCalledWith('nitro:functions:app-flags:.json')
    })

    it('rejects invalid patches without writing to storage', async () => {
        const { updateAppFlags } = await import('../../../server/utils/appFlags')

        await expect(updateAppFlags({ allowedBoothCategoryId: ['208'] })).rejects.toThrow()
        expect(flagsStorage.setItem).not.toHaveBeenCalled()
        expect(cacheStorage.del).not.toHaveBeenCalled()
    })
})
