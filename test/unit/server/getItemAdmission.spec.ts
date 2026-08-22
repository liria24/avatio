import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@@/database/schema', () => ({
    itemCategoryOverrides: {
        platform: 'item_category_overrides.platform',
        itemId: 'item_category_overrides.item_id',
        category: 'item_category_overrides.category',
    },
    items: { id: 'items.id' },
    shops: { id: 'shops.id' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
const getForceUpdateItemFlag = vi.fn()
const getItemAdmission = vi.fn()
vi.mock('../../../server/utils/appConfig', () => ({ getForceUpdateItemFlag, getItemAdmission }))

const findFirst = vi.fn()
const externalFetch = vi.fn()
const notFound = vi.fn(() => Object.assign(new Error('Not found'), { statusCode: 404 }))

const db = {
    query: {
        items: { findFirst },
    },
}

const cachedItem = {
    id: 'owner/repo',
    updatedAt: new Date(0),
    name: 'repo',
    niceName: null,
    image: null,
    category: 'other' as const,
    price: null,
    likes: 1,
    nsfw: false,
    outdated: false,
    platform: 'github' as const,
    shop: {
        id: 'owner',
        platform: 'github' as const,
        name: 'owner',
        image: null,
        verified: false,
    },
}

beforeEach(() => {
    findFirst.mockReset()
    getForceUpdateItemFlag.mockReset().mockResolvedValue(false)
    getItemAdmission.mockReset().mockResolvedValue({
        allowedBoothCategories: new Set<number>(),
        override: undefined,
    })
    externalFetch.mockReset()
    notFound.mockClear()
    vi.stubGlobal('logger', () => ({ error: vi.fn(), info: vi.fn() }))
    vi.stubGlobal('$fetch', externalFetch)
    vi.stubGlobal('serverError', { notFound })
    vi.stubGlobal('getForceUpdateItemFlag', getForceUpdateItemFlag)
    vi.stubGlobal('getItemAdmission', getItemAdmission)
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('getItem admission boundary', () => {
    it('returns a stale cached item without enabling provider resolution', async () => {
        findFirst.mockResolvedValue(cachedItem)
        const getItem = (await import('../../../server/utils/getItem')).default

        await expect(getItem(undefined, db as never, cachedItem.id, undefined)).resolves.toEqual(
            cachedItem,
        )

        expect(getForceUpdateItemFlag).not.toHaveBeenCalled()
        expect(externalFetch).not.toHaveBeenCalled()
    })

    it('rejects a cold lookup before provider fetches when resolution is not allowed', async () => {
        findFirst.mockResolvedValue(null)
        const getItem = (await import('../../../server/utils/getItem')).default

        await expect(getItem(undefined, db as never, 'owner/repo', 'github')).rejects.toMatchObject(
            {
                statusCode: 404,
            },
        )

        expect(getForceUpdateItemFlag).not.toHaveBeenCalled()
        expect(externalFetch).not.toHaveBeenCalled()
    })

    it('runs admission control before any provider fetch', async () => {
        findFirst.mockResolvedValue(null)
        const admissionError = new Error('rate limited')
        const beforeExternalResolution = vi.fn().mockRejectedValue(admissionError)
        const getItem = (await import('../../../server/utils/getItem')).default

        await expect(
            getItem(undefined, db as never, 'owner/repo', 'github', {
                allowExternalResolution: true,
                beforeExternalResolution,
            }),
        ).rejects.toBe(admissionError)

        expect(beforeExternalResolution).toHaveBeenCalledOnce()
        expect(externalFetch).not.toHaveBeenCalled()
    })
})
