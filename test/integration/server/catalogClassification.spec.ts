import { SQLiteCatalogRepository } from '@avatio/cloudflare'
import type { CatalogClassificationResult } from '@avatio/core'
import type { H3Event } from '@nuxt/nitro-server/h3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { catalogItems, itemSources } from '../../../database/schema'
import { createTestD1 } from '../../helpers/d1'

let database: ReturnType<typeof createTestD1>
let db: ReturnType<typeof drizzle<typeof relations>>
let repository: SQLiteCatalogRepository
const classify = vi.fn<() => Promise<CatalogClassificationResult>>()

beforeEach(() => {
    database = createTestD1()
    db = drizzle(database.binding, { relations })
    repository = new SQLiteCatalogRepository(db, async (queries) => {
        const first = queries[0]!
        return (await db.batch([first, ...queries.slice(1)])) as unknown[]
    })
    classify.mockReset()
    vi.stubGlobal('logger', () => ({ warn: vi.fn() }))
    vi.stubGlobal('getCatalogItemClassifier', () => ({
        model: 'typesafe/jev',
        classifier: { classify },
    }))
    vi.stubGlobal(
        'invalidateCacheResources',
        vi.fn(async () => undefined),
    )
    vi.stubGlobal('EDGE_CACHE_TAGS', { items: 'items' })
})

afterEach(() => {
    database.sqlite.close()
    vi.unstubAllGlobals()
    vi.resetModules()
})

const createAvailableSource = async () => {
    const source = await repository.ensureSource({
        providerKey: 'booth',
        externalId: '123',
        canonicalUrl: 'https://booth.pm/items/123',
    })
    const now = new Date()
    const lease = await repository.claimDueSource(
        source.id,
        now,
        new Date(now.getTime() + 30_000),
        true,
    )
    if (!lease) throw new Error('Expected source lease')
    await repository.completeSourceSync({
        sourceId: source.id,
        leaseToken: lease.token,
        availability: 'available',
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
            category: null,
            metadata: { description: 'A VR avatar' },
            publisherSourceId: null,
        },
        checkedAt: now,
        nextCheckAt: new Date(now.getTime() + 60_000),
        successful: true,
    })
    return (await repository.findSource(source.id))!
}

it('applies only current high-confidence classifications and preserves manual overrides', async () => {
    classify
        .mockResolvedValueOnce({
            category: 'avatar',
            confidence: 0.84,
            probabilities: { avatar: 0.84, unknown: 0.16 },
            model: 'jev-1.13.0',
        })
        .mockResolvedValueOnce({
            category: 'unknown',
            confidence: 0.99,
            probabilities: { avatar: 0.01, unknown: 0.99 },
            model: 'jev-1.13.0',
        })
        .mockResolvedValueOnce({
            category: 'avatar',
            confidence: 0.85,
            probabilities: { avatar: 0.85, unknown: 0.15 },
            model: 'jev-1.13.0',
        })
    let source = await createAvailableSource()
    const { classifyCatalogSource } = await import('../../../server/utils/catalogClassification')

    await classifyCatalogSource({} as H3Event, repository, source)
    await classifyCatalogSource({} as H3Event, repository, source)
    expect(classify).toHaveBeenCalledOnce()
    expect(await repository.findItem(source.itemId)).toMatchObject({
        categoryOverride: null,
        categoryOverrideOrigin: null,
    })
    expect(await repository.findClassification(source.itemId)).toMatchObject({
        status: 'uncertain',
        confidence: 0.84,
    })

    await db
        .update(itemSources)
        .set({ displayName: 'Updated Avatar', updatedAt: new Date(source.updatedAt.getTime() + 1) })
        .where(eq(itemSources.id, source.id))
    source = (await repository.findSource(source.id))!
    await classifyCatalogSource({} as H3Event, repository, source)
    expect(await repository.findItem(source.itemId)).toMatchObject({
        categoryOverride: null,
        categoryOverrideOrigin: null,
    })
    expect(await repository.findClassification(source.itemId)).toMatchObject({
        status: 'uncertain',
        category: 'unknown',
        confidence: 0.99,
    })

    await db
        .update(itemSources)
        .set({
            displayName: 'Categorized Avatar',
            updatedAt: new Date(source.updatedAt.getTime() + 1),
        })
        .where(eq(itemSources.id, source.id))
    source = (await repository.findSource(source.id))!
    await classifyCatalogSource({} as H3Event, repository, source)
    expect(await repository.findItem(source.itemId)).toMatchObject({
        categoryOverride: 'avatar',
        categoryOverrideOrigin: 'ai',
    })

    await db
        .update(catalogItems)
        .set({ categoryOverride: 'clothing', categoryOverrideOrigin: 'manual' })
        .where(eq(catalogItems.id, source.itemId))
    await db
        .update(itemSources)
        .set({ displayName: 'Another Avatar', updatedAt: new Date(source.updatedAt.getTime() + 1) })
        .where(eq(itemSources.id, source.id))
    source = (await repository.findSource(source.id))!
    await classifyCatalogSource({} as H3Event, repository, source)
    expect(classify).toHaveBeenCalledTimes(3)
    expect(await repository.findItem(source.itemId)).toMatchObject({
        categoryOverride: 'clothing',
        categoryOverrideOrigin: 'manual',
    })
})
