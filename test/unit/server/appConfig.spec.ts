import { afterEach, describe, expect, it, vi } from 'vitest'

import { getForceUpdateItemFlag, getMaintenanceFlag } from '../../../server/utils/appConfig'

vi.mock('@@/database/schema', () => ({
    allowedBoothCategories: {},
    itemCategoryOverrides: {},
}))
vi.mock('drizzle-orm', () => ({ asc: vi.fn(), sql: vi.fn() }))

describe('Flagship flags', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('fails closed when the Flagship binding is missing', async () => {
        vi.stubGlobal('__env__', {})

        await expect(getMaintenanceFlag()).resolves.toBe(false)
    })

    it('fails closed when Flagship cannot read a boolean value', async () => {
        vi.stubGlobal('__env__', {
            FLAGS: { getBooleanValue: vi.fn().mockRejectedValue(new Error('unavailable')) },
        })

        await expect(getForceUpdateItemFlag()).resolves.toBe(false)
    })
})
