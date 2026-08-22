import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const log = { error: vi.fn() }
const storage = { del: vi.fn(), getItem: vi.fn(), setItem: vi.fn() }
const purge = vi.fn()
const getItem = vi.fn()

beforeEach(() => {
    vi.stubGlobal('logger', () => log)
    vi.stubGlobal('getItem', getItem)
    vi.stubGlobal('useStorage', () => storage)
    vi.stubGlobal('purgeEdgeCacheTagsWithContext', purge)
    vi.stubGlobal('getSetupCacheTag', (id: string) => `setup:${id}`)
    vi.stubGlobal('EDGE_CACHE_TAGS', {
        items: 'items',
        popularAvatars: 'popular-avatars',
        setups: 'setups',
    })
    storage.del.mockReset().mockResolvedValue(undefined)
    storage.getItem.mockReset().mockResolvedValue(undefined)
    storage.setItem.mockReset().mockResolvedValue(undefined)
    purge.mockReset().mockResolvedValue(undefined)
    getItem.mockReset()
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('handleItemRevalidationMessage', () => {
    it('sends expired items through the local development queue', async () => {
        const originalNodeEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'development'
        const send = vi.fn().mockResolvedValue(undefined)
        const queue = { send }
        vi.stubGlobal('getRuntimeEnv', () => ({ ITEM_REVALIDATION_QUEUE: queue }))

        try {
            const { enqueueItemRevalidation } =
                await import('../../../server/utils/itemRevalidationQueue')
            const item = {
                id: 'owner/repo',
                platform: 'github' as const,
                updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            }

            await expect(enqueueItemRevalidation({} as never, item, 'setup-detail')).resolves.toBe(
                true,
            )

            expect(send).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: item.id,
                    platform: item.platform,
                    reason: 'setup-detail',
                }),
            )
            expect(storage.setItem).toHaveBeenCalledWith(
                'item-revalidation:github:owner%2Frepo',
                true,
                { ttl: 60 * 30 },
            )
        } finally {
            if (originalNodeEnv === undefined) delete process.env.NODE_ENV
            else process.env.NODE_ENV = originalNodeEnv
        }
    })

    it('waits for item persistence before purging all affected cache tags', async () => {
        let finishPersistence!: (item: { id: string }) => void
        getItem.mockReturnValue(
            new Promise<{ id: string }>((resolve) => {
                finishPersistence = resolve
            }),
        )

        const db = {
            query: {
                setupItems: {
                    findMany: vi
                        .fn()
                        .mockResolvedValue([{ setupId: 'a' }, { setupId: 'a' }, { setupId: 'b' }]),
                },
            },
        }
        vi.stubGlobal('useDB', () => db)

        const cache = { purge: vi.fn() }
        const message = {
            id: 'owner/repo',
            platform: 'github' as const,
            reason: 'setup-detail' as const,
            requestedAt: new Date().toISOString(),
        }
        const pending = import('../../../server/utils/itemRevalidationQueue').then(
            ({ handleItemRevalidationMessage }) =>
                handleItemRevalidationMessage(message, cache as never),
        )

        await vi.waitFor(() => expect(getItem).toHaveBeenCalled())
        expect(getItem).toHaveBeenCalledWith(undefined, db, message.id, message.platform, {
            allowExternalResolution: true,
            cache,
        })
        expect(purge).not.toHaveBeenCalled()

        finishPersistence({ id: message.id })
        await pending

        expect(purge).toHaveBeenCalledWith(
            cache,
            ['items', 'popular-avatars', 'setups', 'setup:a', 'setup:b'],
            'item revalidation',
        )
        expect(storage.del).toHaveBeenCalledOnce()
    })

    it('purges related caches after a permanent not-found revalidation', async () => {
        getItem.mockRejectedValue({ statusCode: 404 })
        const db = {
            query: {
                setupItems: {
                    findMany: vi.fn().mockResolvedValue([{ setupId: 'a' }]),
                },
            },
        }
        vi.stubGlobal('useDB', () => db)
        const cache = { purge: vi.fn() }
        const { handleItemRevalidationMessage } =
            await import('../../../server/utils/itemRevalidationQueue')

        await handleItemRevalidationMessage(
            {
                id: 'missing',
                platform: 'booth',
                reason: 'owned-avatars',
                requestedAt: new Date().toISOString(),
            },
            cache as never,
        )

        expect(purge).toHaveBeenCalledWith(
            cache,
            ['items', 'popular-avatars', 'setups', 'setup:a'],
            'item revalidation',
        )
        expect(storage.del).toHaveBeenCalledOnce()
    })

    it('finds related setups by the canonical item id after an id migration', async () => {
        getItem.mockResolvedValue({ id: 'Owner/Repo' })
        const findMany = vi.fn().mockResolvedValue([{ setupId: 'a' }])
        vi.stubGlobal('useDB', () => ({ query: { setupItems: { findMany } } }))
        const cache = { purge: vi.fn() }
        const { handleItemRevalidationMessage } =
            await import('../../../server/utils/itemRevalidationQueue')

        await handleItemRevalidationMessage(
            {
                id: 'owner/repo',
                platform: 'github',
                reason: 'setup-detail',
                requestedAt: new Date().toISOString(),
            },
            cache as never,
        )

        expect(findMany).toHaveBeenCalledWith({
            where: { itemId: { eq: 'Owner/Repo' } },
            columns: { setupId: true },
        })
        expect(purge).toHaveBeenCalledWith(
            cache,
            ['items', 'popular-avatars', 'setups', 'setup:a'],
            'item revalidation',
        )
    })
})
