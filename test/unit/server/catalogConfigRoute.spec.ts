import { drizzle } from 'drizzle-orm/d1'
import type { ZodType } from 'zod'

import { relations } from '../../../database/relations'
import { allowedBoothCategories, catalogItems, items, itemSources } from '../../../database/schema'
import type { AppDatabase } from '../../../server/utils/database'
import { executeD1Batch } from '../../../server/utils/executeD1Batch'
import { createTestD1 } from '../../helpers/d1'

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

it('updates catalog configuration in D1 and restores the primary legacy category when overrides are removed', async () => {
    const database = createTestD1()
    const db = drizzle(database.binding, { relations })
    let input: unknown = {
        allowedBoothCategoryId: [208, 125, 208],
        specificItemCategories: { booth: { '100': 'texture', '200': 'tool' } },
    }
    vi.stubGlobal('promiseEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireUserSession', vi.fn())
    vi.stubGlobal('validateBody', async (schema: ZodType) => schema.parse(input))
    vi.stubGlobal('executeD1Batch', executeD1Batch)
    vi.stubGlobal('invalidateCacheResources', vi.fn())
    vi.stubGlobal('EDGE_CACHE_TAGS', { items: 'items' })
    vi.stubGlobal('readAppConfig', vi.fn())
    try {
        await db.insert(catalogItems).values({ id: 'catalog' })
        await db.insert(items).values([
            { id: '100', platform: 'booth', name: 'Secondary', category: 'clothing' },
            { id: '200', platform: 'booth', name: 'Primary', category: 'shader' },
        ])
        await db.insert(itemSources).values(
            ['100', '200'].map((externalId) => ({
                id: `source-${externalId}`,
                itemId: 'catalog',
                providerKey: 'booth',
                externalId,
                canonicalUrl: `https://booth.pm/ja/items/${externalId}`,
                displayName: externalId,
                primary: externalId === '200',
            })),
        )
        const route = (await import('../../../server/api/admin/config/index.put'))
            .default as unknown as (context: { db: AppDatabase; event: object }) => Promise<unknown>
        await route({ db, event: {} })
        expect(
            await db.select({ id: allowedBoothCategories.categoryId }).from(allowedBoothCategories),
        ).toEqual([{ id: 125 }, { id: 208 }])
        expect((await db.select().from(catalogItems))[0]).toMatchObject({
            categoryOverride: 'tool',
            categoryOverrideOrigin: 'manual',
        })

        input = { allowedBoothCategoryId: [208], specificItemCategories: {} }
        await route({ db, event: {} })
        expect((await db.select().from(catalogItems))[0]).toMatchObject({
            categoryOverride: 'shader',
            categoryOverrideOrigin: 'legacy',
        })
    } finally {
        database.sqlite.close()
    }
})
