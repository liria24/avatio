import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    handleItemRevalidationMessage,
    isLegacyItemRevalidationMessage,
    isUnfencedCatalogMessage,
} from '../../../server/migration/catalog/queueCompatibility'
const { ensureSource, findSource, claim, release, sync, schedule } = vi.hoisted(() => ({
    ensureSource: vi.fn(),
    findSource: vi.fn(),
    claim: vi.fn(),
    release: vi.fn(),
    sync: vi.fn(),
    schedule: vi.fn(),
}))
vi.mock('@avatio/core/catalog', () => ({ syncCatalogSource: sync }))
vi.mock('~~/server/migration/catalog/migration', () => ({
    ensureLegacyCatalogSource: ensureSource,
}))
vi.mock('~~/server/utils/database', () => ({ useDB: () => ({}) }))
vi.mock('~~/server/utils/catalogRuntime', () => ({
    getCatalogRepository: () => ({
        findSource,
        claimDueSource: claim,
        releaseSourceLease: release,
        scheduleSourceCheck: schedule,
    }),
    getCatalogCacheInvalidator: () => ({}),
    getCatalogProviderRegistry: async () => ({}),
}))
const legacy = {
    id: '123',
    platform: 'booth' as const,
    reason: 'setup-detail' as const,
    force: true,
}
beforeEach(() => {
    vi.resetAllMocks()
    ensureSource.mockResolvedValue({ id: 'source', syncLeaseUntil: null })
    claim.mockResolvedValue({ sourceId: 'source', token: 'new-token' })
})
afterEach(() => vi.restoreAllMocks())
describe('retained Queue translation', () => {
    it('accepts retained shapes without treating malformed current tokens as legacy', () => {
        expect(isLegacyItemRevalidationMessage(legacy)).toBe(true)
        expect(
            isUnfencedCatalogMessage({
                version: 2,
                type: 'catalog.sync-source',
                sourceId: 'source',
            }),
        ).toBe(true)
        expect(
            isUnfencedCatalogMessage({
                version: 2,
                type: 'catalog.sync-source',
                sourceId: 'source',
                leaseToken: '',
            }),
        ).toBe(false)
    })
    it('maps one source and routes only through a newly fenced v2 sync', async () => {
        await handleItemRevalidationMessage(legacy)
        expect(ensureSource).toHaveBeenCalledWith({}, 'booth', '123')
        expect(sync).toHaveBeenCalledWith(
            expect.objectContaining({ sourceId: 'source', leaseToken: 'new-token' }),
        )
    })
    it('does not borrow a live lease or mutate its schedule', async () => {
        ensureSource.mockResolvedValue({
            id: 'source',
            syncLeaseUntil: new Date(Date.now() + 60_000),
        })
        await handleItemRevalidationMessage(legacy)
        expect(claim).not.toHaveBeenCalled()
        expect(schedule).not.toHaveBeenCalled()
        expect(sync).not.toHaveBeenCalled()
    })
    it('releases only its newly acquired lease if provider initialization fails', async () => {
        sync.mockRejectedValue(new Error('failure'))
        await expect(handleItemRevalidationMessage(legacy)).rejects.toThrow('failure')
        expect(release).toHaveBeenCalledWith({ sourceId: 'source', token: 'new-token' })
    })
})
