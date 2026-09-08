import { drizzle } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import {
    catalogItemRelations,
    projectCatalogItem,
    queryCatalogItems,
} from '../../../server/utils/catalogQuery'
import type { AppDatabase } from '../../../server/utils/database'
import { projectSetupEntry, querySetupProjection } from '../../../server/utils/setupQuery'
import { createTestD1 } from '../../helpers/d1'

let database: ReturnType<typeof createTestD1>
let db: AppDatabase
beforeEach(() => {
    database = createTestD1()
    db = drizzle(database.binding, { relations })
    Object.entries({
        catalogItemRelations,
        projectCatalogItem,
        projectSetupEntry,
        withSetupImageUrls: async (images: unknown[]) => images,
        sessionEventHandler: (handler: unknown) => handler,
        authedSessionEventHandler: (handler: unknown) => handler,
        applyPublicEdgeCache: vi.fn(),
        applyNoStoreCache: vi.fn(),
        EDGE_CACHE_TAGS: { setups: 'setups' },
    }).forEach(([key, value]) => vi.stubGlobal(key, value))
    database.sqlite.exec(`
        INSERT INTO users (id, name, username, display_username, email) VALUES
            ('owner', 'Owner', 'owner', 'Owner', 'owner@example.com'),
            ('other', 'Other', 'other', 'Other', 'other@example.com');
        INSERT INTO catalog_items (id, display_name_override, category_override) VALUES ('catalog', 'Curated', 'hair');
        INSERT INTO item_sources (id, item_id, provider_key, external_id, canonical_url, display_name, mapped_category, availability, sync_state, "primary")
        VALUES ('source', 'catalog', 'future-provider', 'external', 'https://example.com/external', 'Provider name', 'clothing', 'available', 'error', 1);
        INSERT INTO setups (id, user_id, name, public, hid_at) VALUES
            ('public', 'owner', 'Public', 1, NULL), ('private', 'owner', 'Private', 0, NULL), ('hidden', 'owner', 'Hidden', 1, 1);
        INSERT INTO setup_entries (id, setup_id, item_id, category_override, note, unsupported) VALUES
            ('entry', 'public', 'catalog', 'avatar', 'Keep this note', 1),
            ('private-entry', 'private', 'catalog', 'avatar', NULL, 0), ('hidden-entry', 'hidden', 'catalog', 'avatar', NULL, 0);
        INSERT INTO setup_entry_shapekeys (setup_entry_id, name, value) VALUES ('entry', 'Smile', 0.5);
        INSERT INTO bookmarks (user_id, setup_id) VALUES ('other', 'public'), ('other', 'private'), ('other', 'hidden');
        INSERT INTO setup_images (setup_id, object_key, width, height, theme_colors)
        VALUES ('public', 'setups/public/image.png', 1200, 800, '["#123456"]');
    `)
})
afterEach(() => {
    database.sqlite.close()
    vi.unstubAllGlobals()
})

describe('provider-neutral Catalog and Setup queries', () => {
    it('preserves entry fields and category precedence even when a source refresh failed', async () => {
        const result = await querySetupProjection(db, 'public')
        expect(result?.setup.entries[0]).toMatchObject({
            id: 'entry',
            category: 'avatar',
            note: 'Keep this note',
            unsupported: true,
            shapekeys: [{ name: 'Smile', value: 0.5 }],
            catalogItem: {
                id: 'catalog',
                name: 'Curated',
                category: 'hair',
                primarySource: {
                    providerKey: 'future-provider',
                    externalId: 'external',
                    availability: 'available',
                    syncState: 'error',
                },
            },
        })
        expect(result?.setup).not.toHaveProperty('items')
        expect(result?.catalogItemIds).toEqual(['catalog'])
        expect(result?.sourceIds).toEqual(['source'])
        expect(result?.setup.failedItemsCount).toBeUndefined()
        database.sqlite.exec(
            'UPDATE setup_entries SET category_override = NULL; UPDATE catalog_items SET category_override = NULL',
        )
        expect((await querySetupProjection(db, 'public'))?.setup.entries[0]?.category).toBe(
            'clothing',
        )
    })
    it('retains a withdrawn entry and its shapekeys without presenting a refresh error as withdrawal', async () => {
        database.sqlite.exec("UPDATE item_sources SET availability = 'withdrawn'")
        const result = await querySetupProjection(db, 'public')
        expect(result?.setup.entries).toHaveLength(1)
        expect(result?.setup.entries[0]?.shapekeys).toEqual([{ name: 'Smile', value: 0.5 }])
        expect(result?.setup.failedItemsCount).toBe(1)
    })
    it.each(['private', 'hidden'])('restricts %s to the owner or an administrator', async (id) => {
        expect(await querySetupProjection(db, id)).toBeNull()
        expect(await querySetupProjection(db, id, { userId: 'other' })).toBeNull()
        expect(await querySetupProjection(db, id, { userId: 'owner' })).not.toBeNull()
        expect(
            await querySetupProjection(db, id, { userId: 'other', role: 'admin' }),
        ).not.toBeNull()
    })
    it('queries public avatar usage with effective Setup categories and filters Catalog categories independently', async () => {
        expect(
            (await queryCatalogItems(db, { publicAvatars: true, limit: 10 })).data.map(
                (item) => item.id,
            ),
        ).toEqual(['catalog'])
        expect((await queryCatalogItems(db, { category: ['avatar'], limit: 10 })).data).toEqual([])
        expect(
            (await queryCatalogItems(db, { category: ['hair'], q: 'Provider', limit: 10 })).data,
        ).toHaveLength(1)
        database.sqlite.exec('UPDATE setups SET public = 0')
        expect((await queryCatalogItems(db, { publicAvatars: true, limit: 10 })).data).toEqual([])
        expect((await queryCatalogItems(db, { ownerId: 'owner', limit: 10 })).data).toHaveLength(1)
    })
    it('does not expose private or hidden Setups owned by others through bookmarks', async () => {
        vi.stubGlobal('validateQuery', async () => ({
            page: 1,
            limit: 20,
            sort: 'desc',
            bookmarked: true,
        }))
        const route = (await import('../../../server/api/setups/index.get'))
            .default as unknown as (input: {
            db: AppDatabase
            event: H3Event
            session: { user: { id: string; username?: string } }
        }) => Promise<{ data: { id: string; images: unknown[] }[] }>
        const result = await route({
            db,
            event: {} as H3Event,
            session: { user: { id: 'other', username: 'other' } },
        })
        expect(result.data.map((setup) => setup.id)).toEqual(['public'])
        expect(result.data[0]?.images).toEqual([
            {
                objectKey: 'setups/public/image.png',
                width: 1200,
                height: 800,
                themeColors: ['#123456'],
            },
        ])
        vi.stubGlobal('validateQuery', async () => ({
            page: 1,
            limit: 20,
            sort: 'desc',
            orderBy: 'createdAt',
        }))
        const bookmarks = (await import('../../../server/api/setups/bookmarks/index.get'))
            .default as unknown as typeof route
        const bookmarked = await bookmarks({
            db,
            event: {} as H3Event,
            session: { user: { id: 'other' } },
        })
        expect(bookmarked.data).toHaveLength(1)
    })
    it('keeps public lists cookie-independent and applies mutes only to explicit viewer feeds', async () => {
        database.sqlite.exec(
            "INSERT INTO user_follows (user_id, followee_id) VALUES ('other', 'owner'); INSERT INTO user_mutes (id, user_id, mutee_id) VALUES ('mute', 'other', 'owner')",
        )
        const route = (await import('../../../server/api/setups/index.get'))
            .default as unknown as (input: {
            db: AppDatabase
            event: H3Event
            session: { user: { id: string } } | null
        }) => Promise<{ data: { id: string }[] }>
        const input = { db, event: {} as H3Event, session: { user: { id: 'other' } } }
        vi.stubGlobal('validateQuery', async () => ({ page: 1, limit: 20, sort: 'desc' }))
        expect((await route(input)).data).toEqual((await route({ ...input, session: null })).data)
        expect(applyPublicEdgeCache).toHaveBeenCalledTimes(2)
        vi.stubGlobal('validateQuery', async () => ({
            page: 1,
            limit: 20,
            sort: 'desc',
            following: true,
        }))
        expect((await route(input)).data).toEqual([])
        expect(applyNoStoreCache).toHaveBeenCalled()
        database.sqlite.exec('DELETE FROM user_mutes')
        expect((await route(input)).data.map((s) => s.id)).toEqual(['public'])
    })
})
