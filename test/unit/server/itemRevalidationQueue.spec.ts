import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PermanentItemResolutionError } from '../../../server/utils/itemResolutionError'

const getItem = vi.fn()
const findSourceByExternalId = vi.fn()
const invalidate = vi.fn()

beforeEach(() => {
    vi.stubGlobal('getItem', getItem)
    vi.stubGlobal('useDB', () => ({ marker: 'db' }))
    vi.stubGlobal('getCatalogRepository', () => ({ findSourceByExternalId }))
    vi.stubGlobal('getCatalogCacheInvalidator', () => ({ invalidate }))
    getItem.mockReset()
    findSourceByExternalId.mockReset()
    invalidate.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('legacy item revalidation queue compatibility', () => {
    it('waits for persistence and invalidates only the CatalogItem resource', async () => {
        let finishPersistence!: (item: { id: string }) => void
        getItem.mockReturnValue(
            new Promise<{ id: string }>((resolve) => {
                finishPersistence = resolve
            }),
        )
        findSourceByExternalId.mockResolvedValue({ itemId: 'catalog-item-1' })
        const message = {
            id: 'owner/repo',
            platform: 'github' as const,
            reason: 'setup-detail' as const,
            requestedAt: new Date().toISOString(),
            force: true,
        }
        const pending = import('../../../server/utils/itemRevalidationQueue').then(
            ({ handleItemRevalidationMessage }) =>
                handleItemRevalidationMessage(message, {} as never),
        )

        await vi.waitFor(() => expect(getItem).toHaveBeenCalled())
        expect(invalidate).not.toHaveBeenCalled()
        finishPersistence({ id: 'Owner/Repo' })
        await pending

        expect(findSourceByExternalId).toHaveBeenCalledWith('github', 'Owner/Repo')
        expect(invalidate).toHaveBeenCalledWith({ items: ['catalog-item-1'] })
    })

    it('keeps confirmed missing items eligible for CatalogItem invalidation', async () => {
        getItem.mockRejectedValue(
            new PermanentItemResolutionError('Item missing', 'provider-not-found'),
        )
        findSourceByExternalId.mockResolvedValue({ itemId: 'catalog-item-2' })
        const { handleItemRevalidationMessage } =
            await import('../../../server/utils/itemRevalidationQueue')

        await handleItemRevalidationMessage({
            id: 'missing',
            platform: 'booth',
            reason: 'owned-avatars',
            requestedAt: new Date().toISOString(),
        })

        expect(invalidate).toHaveBeenCalledWith({ items: ['catalog-item-2'] })
    })

    it('retries an unclassified 404', async () => {
        const error = { statusCode: 404 }
        getItem.mockRejectedValue(error)
        const { handleItemRevalidationMessage } =
            await import('../../../server/utils/itemRevalidationQueue')

        await expect(
            handleItemRevalidationMessage({
                id: 'missing',
                platform: 'booth',
                reason: 'owned-avatars',
                requestedAt: new Date().toISOString(),
            }),
        ).rejects.toBe(error)
        expect(findSourceByExternalId).not.toHaveBeenCalled()
        expect(invalidate).not.toHaveBeenCalled()
    })
})
