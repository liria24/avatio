import { toCloudflareCacheTags } from '@avatio/cloudflare'
import {
    CatalogProviderRegistry,
    enqueueDueCatalogSources,
    forceEnqueueCatalogSources,
    syncCatalogSource,
    type CatalogProvider,
    type CatalogRepository,
    type ItemSource,
    type SourceLease,
} from '@avatio/core/catalog'

const source = (overrides: Partial<ItemSource> = {}): ItemSource => ({
    id: 'source-1',
    itemId: 'catalog-item-1',
    providerKey: 'test',
    externalId: 'external-1',
    canonicalUrl: 'https://catalog.example/external-1',
    publisherSourceId: null,
    primary: true,
    availability: 'available',
    syncState: 'stale',
    snapshot: null,
    lastCheckedAt: null,
    lastSuccessfulSyncAt: null,
    nextCheckAt: new Date(0),
    syncLeaseUntil: null,
    syncLeaseToken: null,
    lastErrorKind: null,
    lastErrorAt: null,
    ...overrides,
})

const repository = (implementations: Partial<CatalogRepository> = {}): CatalogRepository => ({
    findItem: vi.fn(async () => null),
    findSource: vi.fn(async () => source()),
    findSourceByExternalId: vi.fn(async () => null),
    ensureSource: vi.fn(async () => source()),
    scheduleSourceCheck: vi.fn(async () => true),
    claimDueSource: vi.fn(async () => null),
    releaseSourceLease: vi.fn(async () => undefined),
    markSyncStarted: vi.fn(async () => source({ syncState: 'syncing' })),
    completeSourceSync: vi.fn(async () => 'catalog-item-1'),
    ...implementations,
})

describe('demand-driven Catalog source enqueueing', () => {
    it('does not enqueue when a source is not due', async () => {
        const repo = repository()
        const queue = { enqueue: vi.fn(async () => undefined) }
        const result = await enqueueDueCatalogSources({
            sourceIds: ['source-1'],
            repository: repo,
            queue,
        })
        expect(result.enqueued).toEqual([])
        expect(queue.enqueue).not.toHaveBeenCalled()
    })

    it('allows one enqueue across concurrent claims', async () => {
        let leased = false
        const claim = vi.fn(async (): Promise<SourceLease | null> => {
            if (leased) return null
            leased = true
            return { sourceId: 'source-1', token: 'lease-1', expiresAt: new Date(1000) }
        })
        const repo = repository({ claimDueSource: claim })
        const queue = { enqueue: vi.fn(async () => undefined) }

        const results = await Promise.all([
            enqueueDueCatalogSources({ sourceIds: ['source-1'], repository: repo, queue }),
            enqueueDueCatalogSources({ sourceIds: ['source-1'], repository: repo, queue }),
        ])

        expect(results.flatMap(({ enqueued }) => enqueued)).toEqual(['source-1'])
        expect(queue.enqueue).toHaveBeenCalledOnce()
        expect(queue.enqueue).toHaveBeenCalledWith({
            version: 2,
            type: 'catalog.sync-source',
            sourceId: 'source-1',
            leaseToken: 'lease-1',
        })
    })

    it('releases the persistent lease when Queue send fails', async () => {
        const lease = { sourceId: 'source-1', token: 'lease-1', expiresAt: new Date(1000) }
        const releaseSourceLease = vi.fn(async () => undefined)
        const repo = repository({
            claimDueSource: vi.fn(async () => lease),
            releaseSourceLease,
        })
        const result = await enqueueDueCatalogSources({
            sourceIds: ['source-1'],
            repository: repo,
            queue: {
                enqueue: vi.fn(async () => {
                    throw new Error('Queue unavailable')
                }),
            },
        })

        expect(result.failed).toEqual(['source-1'])
        expect(releaseSourceLease).toHaveBeenCalledWith(lease)
    })

    it('forces selected sources due without bypassing the D1 lease', async () => {
        const lease = { sourceId: 'source-1', token: 'lease-1', expiresAt: new Date(1000) }
        const scheduleSourceCheck = vi.fn(async (id: string) => id === 'source-1')
        const claimDueSource = vi.fn(async () => lease)
        const queue = { enqueue: vi.fn(async () => undefined) }
        const result = await forceEnqueueCatalogSources({
            sourceIds: ['source-1', 'missing'],
            repository: repository({ scheduleSourceCheck, claimDueSource }),
            queue,
            now: new Date(0),
        })

        expect(result.enqueued).toEqual(['source-1'])
        expect(result.notFound).toEqual(['missing'])
        expect(queue.enqueue).toHaveBeenCalledWith({
            version: 2,
            type: 'catalog.sync-source',
            sourceId: 'source-1',
            leaseToken: 'lease-1',
        })
    })
})

describe('Catalog synchronization state machine', () => {
    const run = async (provider: CatalogProvider, initial = source()) => {
        const completeSourceSync = vi.fn(async () => initial.itemId)
        const repo = repository({
            markSyncStarted: vi.fn(async () => initial),
            completeSourceSync,
        })
        const invalidate = vi.fn(async () => undefined)
        const result = await syncCatalogSource({
            sourceId: initial.id,
            leaseToken: 'lease-1',
            repository: repo,
            providers: new CatalogProviderRegistry([provider]),
            cacheInvalidator: { invalidate },
            now: new Date('2026-08-24T00:00:00.000Z'),
        })
        return { result, completeSourceSync, invalidate }
    }

    it('records transient errors without changing availability or invalidating public data', async () => {
        const { result, completeSourceSync, invalidate } = await run({
            key: 'test',
            matchUrl: () => null,
            fetch: async () => ({ status: 'transient_error', errorKind: 'provider-http-500' }),
        })
        expect(result.stale).toBe(false)
        if (result.stale) throw new Error('Unexpected stale result')
        expect(result.result.status).toBe('transient_error')
        expect(completeSourceSync).toHaveBeenCalledWith(
            expect.objectContaining({
                availability: undefined,
                successful: false,
                errorKind: 'provider-http-500',
            }),
        )
        expect(invalidate).not.toHaveBeenCalled()
    })

    it('records a confirmed withdrawal and invalidates only its CatalogItem resource', async () => {
        const { completeSourceSync, invalidate } = await run({
            key: 'test',
            matchUrl: () => null,
            fetch: async () => ({ status: 'withdrawn', errorKind: 'provider-not-found' }),
        })
        expect(completeSourceSync).toHaveBeenCalledWith(
            expect.objectContaining({ availability: 'withdrawn', successful: true }),
        )
        expect(invalidate).toHaveBeenCalledWith({ items: ['catalog-item-1'] })
    })

    it('can restore a previously withdrawn source', async () => {
        const { completeSourceSync } = await run(
            {
                key: 'test',
                matchUrl: () => null,
                fetch: async (reference) => ({
                    status: 'available',
                    snapshot: {
                        reference,
                        name: 'Restored',
                        image: null,
                        price: null,
                        popularityCount: null,
                        nsfw: false,
                        category: null,
                        metadata: {},
                        publisherSourceId: null,
                    },
                }),
            },
            source({ availability: 'withdrawn' }),
        )
        expect(completeSourceSync).toHaveBeenCalledWith(
            expect.objectContaining({ availability: 'available', successful: true }),
        )
    })

    it('does not fail synchronization correctness when cache purge fails', async () => {
        const repo = repository({ completeSourceSync: vi.fn(async () => 'catalog-item-1') })
        const result = await syncCatalogSource({
            sourceId: 'source-1',
            leaseToken: 'lease-1',
            repository: repo,
            providers: new CatalogProviderRegistry([
                {
                    key: 'test',
                    matchUrl: () => null,
                    fetch: async () => ({ status: 'withdrawn', errorKind: 'provider-not-found' }),
                },
            ]),
            cacheInvalidator: {
                invalidate: async () => {
                    throw new Error('cache unavailable')
                },
            },
        })
        expect(result.cacheInvalidationFailed).toBe(true)
    })

    it('does not fetch or invalidate a stale lease', async () => {
        const markSyncStarted = vi.fn(async () => null)
        const completeSourceSync = vi.fn(async () => null)
        const repo = repository({ markSyncStarted, completeSourceSync })
        const invalidate = vi.fn()
        const result = await syncCatalogSource({
            sourceId: 'source-1',
            leaseToken: 'old',
            repository: repo,
            providers: new CatalogProviderRegistry([]),
            cacheInvalidator: { invalidate },
        })
        expect(result.stale).toBe(true)
        expect(markSyncStarted).toHaveBeenCalledWith('source-1', 'old', expect.any(Date))
        expect(completeSourceSync).not.toHaveBeenCalled()
        expect(invalidate).not.toHaveBeenCalled()
    })
})

describe('Cloudflare resource tag mapping', () => {
    it('maps semantic IDs without a reverse Setup lookup', () => {
        expect(
            toCloudflareCacheTags({
                items: ['item-1'],
                setups: ['setup-1'],
                users: ['user-1'],
                collections: ['catalog'],
            }),
        ).toEqual(['item:item-1', 'setup:setup-1', 'user:user-1', 'catalog'])
    })
})
