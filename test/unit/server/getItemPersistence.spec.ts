import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@@/database/schema', () => ({
    items: { id: 'items.id' },
    shops: { id: 'shops.id' },
    itemCategoryOverrides: {
        platform: 'itemCategoryOverrides.platform',
        itemId: 'itemCategoryOverrides.itemId',
        category: 'itemCategoryOverrides.category',
    },
}))
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), inArray: vi.fn() }))

const log = { error: vi.fn(), info: vi.fn() }
const purge = vi.fn()
const generateItemAttr = vi.fn()

const makeDb = (migratedOverrides: { itemId: string; category: ItemCategory }[] = []) => {
    const db = {
        batch: vi.fn().mockResolvedValue([]),
        select: vi.fn(() => ({
            from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(migratedOverrides) })),
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => ({ kind: 'update' })) })),
        })),
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                onConflictDoUpdate: vi.fn(() => ({ kind: 'upsert' })),
                onConflictDoNothing: vi.fn(() => ({ kind: 'move-override' })),
            })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(() => ({ kind: 'delete-override' })) })),
    }
    return { db }
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
    categoryOverride: undefined,
    categoryFallback: 'other' as const,
    assignAttrParams: { name: 'repo' },
}

beforeEach(() => {
    vi.stubGlobal('logger', () => log)
    vi.stubGlobal('generateItemAttr', generateItemAttr)
    vi.stubGlobal(
        'executeD1Batch',
        (db: { batch: (queries: unknown[]) => Promise<unknown[]> }, queries: unknown[]) =>
            db.batch(queries),
    )
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

        expect(db.batch).toHaveBeenCalledOnce()
        expect(purge).toHaveBeenCalledOnce()
        expect(db.update).not.toHaveBeenCalled()
    })

    it('keeps HTTP persistence deferred', async () => {
        let finishBatch!: () => void
        const { db } = makeDb()
        db.batch.mockImplementation(
            () =>
                new Promise<never[]>((resolve) => {
                    finishBatch = () => resolve([])
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

        finishBatch()
        await backgroundTasks[0]
        expect(purge).toHaveBeenCalledOnce()
    })

    it('prefers the new override and removes the old conflicting override', async () => {
        const { db } = makeDb([
            { itemId: 'owner/old-repo', category: 'clothing' },
            { itemId: 'owner/repo', category: 'avatar' },
        ])
        const { persistItem } = await import('../../../server/utils/getItem')

        const item = await persistItem(
            db as never,
            {
                ...params,
                cachedItem: { id: 'owner/old-repo' },
                idMigration: { from: 'owner/old-repo', to: 'owner/repo' },
            },
            { defer: false, purge },
        )

        expect(item.category).toBe('avatar')
        expect(db.insert).toHaveBeenCalledTimes(2)
        expect(db.delete).toHaveBeenCalledOnce()
    })

    it('moves the old override when the new id has no override', async () => {
        const { db } = makeDb([{ itemId: 'owner/old-repo', category: 'clothing' }])
        const { persistItem } = await import('../../../server/utils/getItem')

        const item = await persistItem(
            db as never,
            {
                ...params,
                cachedItem: { id: 'owner/old-repo' },
                idMigration: { from: 'owner/old-repo', to: 'owner/repo' },
            },
            { defer: false, purge },
        )

        expect(item.category).toBe('clothing')
        expect(db.insert).toHaveBeenCalledTimes(3)
        expect(db.delete).toHaveBeenCalledOnce()
    })
})
