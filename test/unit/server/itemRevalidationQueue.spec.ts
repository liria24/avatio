import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PermanentItemResolutionError } from '../../../server/utils/itemResolutionError'

const { getItem, findSourceByExternalId, invalidate } = vi.hoisted(() => ({
    getItem: vi.fn(),
    findSourceByExternalId: vi.fn(),
    invalidate: vi.fn(),
}))

vi.mock('~~/server/utils/getItem', () => ({ default: getItem }))
vi.mock('~~/server/utils/database', () => ({ useDB: () => ({ marker: 'db' }) }))
vi.mock('~~/server/utils/catalogRuntime', () => ({
    getCatalogRepository: () => ({ findSourceByExternalId }),
    getCatalogCacheInvalidator: () => ({ invalidate }),
}))

beforeEach(() => {
    getItem.mockReset()
    findSourceByExternalId.mockReset()
    invalidate.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('legacy item revalidation queue compatibility', () => {
    it('recognizes only the retained old queue message shape', async () => {
        const { isLegacyItemRevalidationMessage } =
            await import('../../../server/migration/catalog/queueCompatibility')

        expect(
            isLegacyItemRevalidationMessage({
                id: 'owner/repo',
                platform: 'github',
                reason: 'setup-detail',
                requestedAt: new Date().toISOString(),
            }),
        ).toBe(true)
        expect(
            isLegacyItemRevalidationMessage({
                version: 2,
                type: 'catalog.sync-source',
                sourceId: 'source-1',
            }),
        ).toBe(false)
    })

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
        const pending = import('../../../server/migration/catalog/queueCompatibility').then(
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
            await import('../../../server/migration/catalog/queueCompatibility')

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
            await import('../../../server/migration/catalog/queueCompatibility')

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
