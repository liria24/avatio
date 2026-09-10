import { itemCategorySchema } from '@avatio/core/catalog'
import { drizzle } from 'drizzle-orm/d1'
import { createError, type H3Event } from 'h3'
import type { ZodType } from 'zod'

import { relations } from '../../../database/relations'
import { readAppConfig } from '../../../server/utils/appConfig'
import type { AppDatabase } from '../../../server/utils/database'
import { executeD1Batch } from '../../../server/utils/executeD1Batch'
import { createTestD1 } from '../../helpers/d1'

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})
it('stores manual Catalog overrides atomically and clears only that override layer', async () => {
    const database = createTestD1()
    const db = drizzle(database.binding, { relations })
    let input: unknown = {
        allowedBoothCategoryId: [208, 125, 208],
        catalogCategoryOverrides: { catalog: 'texture' },
    }
    Object.entries({
        promiseEventHandler: (handler: unknown) => handler,
        requireUserSession: vi.fn(),
        validateBody: async (schema: ZodType) => schema.parse(input),
        executeD1Batch,
        itemCategorySchema,
        createError,
        invalidateCacheResources: vi.fn(),
        EDGE_CACHE_TAGS: { items: 'items' },
        readAppConfig,
        getMaintenanceFlag: async () => false,
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
    try {
        database.sqlite.exec(
            "INSERT INTO catalog_items (id, category_override, category_override_origin) VALUES ('catalog', NULL, NULL), ('ai', 'hair', 'ai')",
        )
        const route = (await import('../../../server/api/admin/config/index.put'))
            .default as unknown as (context: {
            db: AppDatabase
            event: H3Event
        }) => Promise<unknown>
        const context = { db, event: {} as H3Event }
        expect(await route(context)).toMatchObject({
            allowedBoothCategoryId: [125, 208],
            catalogCategoryOverrides: { catalog: 'texture' },
        })
        input = { allowedBoothCategoryId: [208], catalogCategoryOverrides: {} }
        await route(context)
        expect(
            database.sqlite
                .prepare(
                    'SELECT id, category_override, category_override_origin FROM catalog_items ORDER BY id',
                )
                .all(),
        ).toEqual([
            { id: 'ai', category_override: 'hair', category_override_origin: 'ai' },
            { id: 'catalog', category_override: null, category_override_origin: null },
        ])
        input = { allowedBoothCategoryId: [], catalogCategoryOverrides: { missing: 'texture' } }
        await expect(route(context)).rejects.toMatchObject({ statusCode: 400 })
        expect(
            database.sqlite.prepare('SELECT category_id FROM allowed_booth_categories').all(),
        ).toEqual([{ category_id: 208 }])
    } finally {
        database.sqlite.close()
    }
})
