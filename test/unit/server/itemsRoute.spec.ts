import { D1CatalogRepository } from '@avatio/cloudflare'
import type { ProviderFetchResult } from '@avatio/core/catalog'
import { drizzle } from 'drizzle-orm/d1'
import { createError, type H3Event } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { queryCatalogItem } from '../../../server/utils/catalogQuery'
import { createTestD1 } from '../../helpers/d1'

let database: ReturnType<typeof createTestD1>
let db: ReturnType<typeof drizzle<typeof relations>>
let repository: D1CatalogRepository
let background: Promise<unknown>[]
const fetchSource = vi.fn<() => Promise<ProviderFetchResult>>()
const rateLimit = vi.fn()
beforeEach(() => {
    database = createTestD1()
    db = drizzle(database.binding, { relations })
    repository = new D1CatalogRepository(database.binding)
    background = []
    rateLimit.mockReset().mockResolvedValue(undefined)
    fetchSource.mockReset().mockResolvedValue({
        status: 'available',
        snapshot: {
            reference: {
                providerKey: 'booth',
                externalId: '123',
                canonicalUrl: 'https://booth.pm/items/123',
            },
            name: 'Avatar',
            image: null,
            price: null,
            popularityCount: null,
            nsfw: false,
            category: { rawKey: '208', mappedCategory: 'avatar' },
            metadata: {},
            publisherSourceId: null,
        },
    })
    Object.entries({
        logger: () => ({ warn: vi.fn() }),
        createError,
        queryCatalogItem,
        getCatalogRepository: () => repository,
        getCatalogProviderRegistry: async () => ({ get: () => ({ fetch: fetchSource }) }),
        getCacheInvalidator: () => ({ invalidate: vi.fn() }),
        enforceRateLimit: rateLimit,
        runAfterResponse: (promise: Promise<unknown>) => background.push(promise),
        enqueueReferencedCatalogSources: async () => undefined,
        generateCatalogAttributes: async () => ({ displayName: 'Short name', category: 'avatar' }),
        invalidateCacheResources: vi.fn(),
        EDGE_CACHE_TAGS: { items: 'items' },
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
})
afterEach(async () => {
    await Promise.all(background)
    database.sqlite.close()
    vi.unstubAllGlobals()
    vi.resetModules()
})
const resolve = async (input = 'https://booth.pm/items/123') => {
    const { resolveCatalogReference } = await import('../../../server/utils/catalogResolution')
    return resolveCatalogReference({} as H3Event, db, input, 'user')
}
it('resolves a provider reference once and returns the same Avatio ID for later reads', async () => {
    const item = await resolve()
    expect(item?.id).not.toBe('123')
    expect(item?.primarySource).toMatchObject({
        externalId: '123',
        availability: 'available',
        syncState: 'fresh',
    })
    await Promise.all(background)
    expect((await resolve(item!.id))?.id).toBe(item!.id)
    expect((await resolve())?.id).toBe(item!.id)
    expect(fetchSource).toHaveBeenCalledTimes(1)
    expect(rateLimit).toHaveBeenCalledTimes(1)
    expect((await repository.findSource(item!.primarySource!.id))?.syncLeaseToken).toBeNull()
})
it('rejects unsupported references and enforces the limit before creating Catalog data', async () => {
    await expect(resolve('https://private.example/items/123')).rejects.toMatchObject({
        statusCode: 400,
    })
    rateLimit.mockRejectedValue(createError({ statusCode: 429 }))
    await expect(resolve()).rejects.toMatchObject({ statusCode: 429 })
    expect(fetchSource).not.toHaveBeenCalled()
    expect(
        database.sqlite.prepare('SELECT count(*) AS count FROM catalog_items').get()?.count,
    ).toBe(0)
})
it('keeps transient errors separate from withdrawal and releases failed leases', async () => {
    await repository.ensureSource({
        providerKey: 'booth',
        externalId: '123',
        canonicalUrl: 'https://booth.pm/items/123',
    })
    fetchSource.mockResolvedValue({ status: 'transient_error', errorKind: 'timeout' })
    await expect(resolve()).rejects.toMatchObject({ statusCode: 503 })
    expect(await repository.findSourceByExternalId('booth', '123')).toMatchObject({
        availability: 'unknown',
        syncState: 'error',
        syncLeaseToken: null,
    })
    database.sqlite.exec('UPDATE item_sources SET next_check_at = 0')
    fetchSource.mockRejectedValue(new Error('Publisher write failed'))
    await expect(resolve()).rejects.toThrow('Publisher write failed')
    expect(await repository.findSourceByExternalId('booth', '123')).toMatchObject({
        availability: 'unknown',
        syncState: 'stale',
        syncLeaseToken: null,
    })
})

it('reuses the canonical identity when the provider normalizes an entered reference', async () => {
    const item = await resolve()
    await Promise.all(background)
    const normalized = await resolve('https://booth.pm/items/00123')
    expect(normalized?.id).toBe(item?.id)
    expect(
        database.sqlite.prepare('SELECT count(*) AS count FROM catalog_items').get()?.count,
    ).toBe(1)
    expect(database.sqlite.prepare('SELECT external_id FROM item_sources').all()).toEqual([
        { external_id: '123' },
    ])
    expect(fetchSource).toHaveBeenCalledTimes(2)
})
