import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@@/database/schema', () => ({
    items: { id: 'items.id' },
    shops: { id: 'shops.id' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))

const log = { error: vi.fn(), info: vi.fn() }
const purge = vi.fn()
const generateItemAttr = vi.fn()

const makeDb = () => {
    const tx = {
        update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        })),
        insert: vi.fn(() => ({
            values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
    }
    const db = {
        transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) =>
            callback(tx),
        ),
        update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        })),
    }
    return { db, tx }
}

const params = {
    valid: true as const,
    item: {
        id: 'owner/repo',
        platform: 'github' as const,
        name: 'repo',
        outdated: false,
        image: null,
        niceName: null,
        price: null,
        nsfw: false,
        likes: 1,
        shopId: 'owner',
    },
    shop: {
        id: 'owner',
        platform: 'github' as const,
        name: 'owner',
        image: null,
        verified: false,
    },
    cachedItem: null,
    specificItemCategories: {},
    categoryFallback: 'other' as const,
    assignAttrParams: { name: 'repo' },
}

beforeEach(() => {
    vi.stubGlobal('logger', () => log)
    vi.stubGlobal('generateItemAttr', generateItemAttr)
    purge.mockReset().mockResolvedValue(undefined)
    generateItemAttr.mockReset()
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('persistItem', () => {
    it('purges the completed transaction even when the later attribute phase fails', async () => {
        const { db } = makeDb()
        generateItemAttr.mockRejectedValue(new Error('AI unavailable'))
        const { persistItem } = await import('../../../server/utils/getItem')

        await expect(persistItem(db as never, params, { defer: false, purge })).rejects.toThrow(
            'AI unavailable',
        )

        expect(db.transaction).toHaveBeenCalledOnce()
        expect(purge).toHaveBeenCalledOnce()
        expect(db.update).not.toHaveBeenCalled()
    })

    it('keeps HTTP persistence deferred', async () => {
        let finishTransaction!: () => void
        const { db } = makeDb()
        db.transaction.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finishTransaction = resolve
                }),
        )
        const backgroundTasks: Promise<unknown>[] = []
        vi.stubGlobal('runAfterResponse', (task: Promise<unknown>) => backgroundTasks.push(task))
        const { persistItem } = await import('../../../server/utils/getItem')

        const item = await persistItem(
            db as never,
            { ...params, cachedItem: { id: params.item.id } },
            { defer: true, purge },
        )

        expect(item.id).toBe(params.item.id)
        expect(backgroundTasks).toHaveLength(1)
        expect(purge).not.toHaveBeenCalled()

        finishTransaction()
        await backgroundTasks[0]
        expect(purge).toHaveBeenCalledOnce()
    })
})
