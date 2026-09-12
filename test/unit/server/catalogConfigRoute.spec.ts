import { itemCategorySchema } from '@avatio/core/catalog'
import type { AppConfig } from '@avatio/core/contracts'
import { createError, type H3Event } from '@nuxt/nitro-server/h3'
import { drizzle } from 'drizzle-orm/d1'
import type { ZodType } from 'zod'

import { relations } from '../../../database/relations'
import { readAppConfig } from '../../../server/utils/appConfig'
import { queryAdminCatalogItem } from '../../../server/utils/catalogQuery'
import type { AppDatabase } from '../../../server/utils/database'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import { createTestD1 } from '../../helpers/d1'

afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
})

it('stores provider admission rules atomically without touching manual item overrides', async () => {
    const database = createTestD1()
    const db = drizzle(database.binding, { relations })
    let input: unknown = {
        providerAdmissionRules: [
            {
                providerKey: 'booth',
                facetKey: 'category',
                valueKey: '208',
                label: 'ignored client label',
                decision: 'deny',
            },
            {
                providerKey: 'booth',
                facetKey: 'tag',
                valueKey: 'VRChat',
                label: 'VRChat',
                decision: 'allow',
            },
        ],
    }
    const provider = {
        key: 'booth',
        admission: {
            match: 'any' as const,
            facets: [
                { key: 'category', discovery: 'observed' as const },
                { key: 'tag', discovery: 'configured-only' as const },
            ],
        },
        normalizeAdmissionValue: (facetKey: string, value: string) => ({
            facetKey,
            valueKey: value.toLowerCase(),
            label: value,
        }),
    }
    const registry = {
        get: (key: string) => (key === provider.key ? provider : null),
        values: () => [provider],
    }
    Object.entries({
        promiseEventHandler: (handler: unknown) => handler,
        requireUserSession: vi.fn(),
        validateBody: async (schema: ZodType) => schema.parse(input),
        executeAppBatch,
        createError,
        readAppConfig,
        getCatalogProviderRegistry: async () => registry,
        getMaintenanceFlag: async () => false,
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
    try {
        database.sqlite.exec(
            "INSERT INTO catalog_items (id, category_override, category_override_origin) VALUES ('catalog', 'texture', 'manual')",
        )
        const route = (await import('../../../server/api/admin/config/index.put'))
            .default as unknown as (context: {
            db: AppDatabase
            event: H3Event
        }) => Promise<AppConfig>
        const context = { db, event: {} as H3Event }
        const saved = await route(context)
        expect(
            saved.providerAdmissions[0]?.facets
                .find(({ key }) => key === 'category')
                ?.options.find(({ valueKey }) => valueKey === '208'),
        ).toMatchObject({ decision: 'deny' })

        input = {
            providerAdmissionRules: [
                {
                    providerKey: 'booth',
                    facetKey: 'tag',
                    valueKey: 'New Tag',
                    label: 'New Tag',
                    decision: 'allow',
                },
            ],
        }
        await route(context)
        expect(
            database.sqlite
                .prepare(
                    'SELECT provider_key, facet_key, value_key, decision FROM provider_admission_rules',
                )
                .all(),
        ).toEqual([
            {
                provider_key: 'booth',
                facet_key: 'tag',
                value_key: 'new tag',
                decision: 'allow',
            },
        ])
        expect(
            database.sqlite
                .prepare(
                    "SELECT category_override, category_override_origin FROM catalog_items WHERE id = 'catalog'",
                )
                .get(),
        ).toEqual({ category_override: 'texture', category_override_origin: 'manual' })

        input = {
            providerAdmissionRules: [
                {
                    providerKey: 'booth',
                    facetKey: 'category',
                    valueKey: '999',
                    label: 'Unknown',
                    decision: 'allow',
                },
            ],
        }
        await expect(route(context)).rejects.toMatchObject({ statusCode: 400 })
        expect(
            database.sqlite.prepare('SELECT value_key FROM provider_admission_rules').all(),
        ).toEqual([{ value_key: 'new tag' }])
    } finally {
        database.sqlite.close()
    }
})

it('sets and clears one manual item category override', async () => {
    const database = createTestD1()
    const db = drizzle(database.binding, { relations })
    let input: unknown = { categoryOverride: 'hair' }
    Object.entries({
        promiseEventHandler: (handler: unknown) => handler,
        requireUserSession: vi.fn(),
        validateParams: async (schema: ZodType) => schema.parse({ id: 'catalog' }),
        validateBody: async (schema: ZodType) => schema.parse(input),
        itemCategorySchema,
        queryAdminCatalogItem,
        invalidateCacheResources: vi.fn(),
        EDGE_CACHE_TAGS: { items: 'items' },
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
    try {
        database.sqlite.exec("INSERT INTO catalog_items (id) VALUES ('catalog')")
        const route = (await import('../../../server/api/admin/items/[...id].patch'))
            .default as unknown as (context: {
            db: AppDatabase
            event: H3Event
        }) => Promise<AdminCatalogItemView>
        const context = { db, event: {} as H3Event }

        await expect(route(context)).resolves.toMatchObject({ manualCategoryOverride: 'hair' })
        input = { categoryOverride: null }
        await expect(route(context)).resolves.toMatchObject({
            category: 'other',
            manualCategoryOverride: null,
        })
    } finally {
        database.sqlite.close()
    }
})
