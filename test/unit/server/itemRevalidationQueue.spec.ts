import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PermanentItemResolutionError } from '../../../server/utils/itemResolutionError'

const log = { error: vi.fn() }
const storage = { del: vi.fn() }
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
    purge.mockReset().mockResolvedValue(undefined)
    getItem.mockReset()
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('handleItemRevalidationMessage', () => {
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
        getItem.mockRejectedValue(
            new PermanentItemResolutionError(
                'BOOTH item missing no longer exists',
                'provider-not-found',
            ),
        )
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

    it('rethrows a generic 404 so the queue can retry it', async () => {
        const error = { statusCode: 404 }
        getItem.mockRejectedValue(error)

        const findMany = vi.fn()
        vi.stubGlobal('useDB', () => ({
            query: {
                setupItems: {
                    findMany,
                },
            },
        }))

        const cache = { purge: vi.fn() }
        const { handleItemRevalidationMessage } =
            await import('../../../server/utils/itemRevalidationQueue')

        await expect(
            handleItemRevalidationMessage(
                {
                    id: 'missing',
                    platform: 'booth',
                    reason: 'owned-avatars',
                    requestedAt: new Date().toISOString(),
                },
                cache as never,
            ),
        ).rejects.toBe(error)

        expect(findMany).not.toHaveBeenCalled()
        expect(purge).not.toHaveBeenCalled()
        expect(storage.del).not.toHaveBeenCalled()
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
