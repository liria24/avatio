import type { H3Event } from '@nuxt/nitro-server/h3'
import { drizzle } from 'drizzle-orm/d1'
import { expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import { completeIdempotencyRequest } from '../../../server/utils/idempotency'
import { createSetup, updateSetup } from '../../../server/utils/setupCommands'
import { createTestD1 } from '../../helpers/d1'

it('persists CatalogItem references, notes and shapekeys atomically across create and update', async () => {
    const database = createTestD1()
    const db = drizzle(database.binding, { relations })
    vi.stubGlobal('executeAppBatch', executeAppBatch)
    vi.stubGlobal('completeIdempotencyRequest', completeIdempotencyRequest)
    vi.stubGlobal('resolveSetupImageData', async () => [])
    vi.stubGlobal('invalidateCacheResources', async () => undefined)
    vi.stubGlobal('EDGE_CACHE_TAGS', {})
    vi.stubGlobal('querySetupProjection', async () => ({ setup: {} }))
    try {
        database.sqlite.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('user', 'User', 'user', 'User', 'user@example.com');
            INSERT INTO setups (id, user_id, name) VALUES ('oldsetup', 'user', 'Old');
            INSERT INTO catalog_items (id) VALUES ('catalog');
            INSERT INTO item_sources (id, item_id, provider_key, external_id, canonical_url, display_name, "primary")
            VALUES ('source', 'catalog', 'booth', '123', 'https://booth.pm/items/123', 'Item', 1);
            INSERT INTO idempotency_requests (id, scope, route, key, request_hash, lease_expires_at, expires_at)
            VALUES ('request', 'user', '/api/setups', 'key', 'hash', 1, 2);
        `)
        const context = { db, user: { id: 'user' }, event: {} as H3Event }
        const input = {
            public: true,
            name: 'New',
            points: [],
            items: [
                {
                    itemId: 'catalog',
                    unsupported: false,
                    shapekeys: [{ name: 'New', value: 0.75 }],
                },
            ],
        }
        const readShapes = () =>
            database.sqlite
                .prepare('SELECT name, value FROM setup_entry_shapekeys ORDER BY id')
                .all()

        await createSetup(context, input, 'newsetup', {
            id: 'request',
            key: 'key',
            resourceId: 'newsetup',
            replay: false,
            response: null,
            statusCode: null,
        })
        expect(readShapes()).toEqual([{ name: 'New', value: 0.75 }])
        await updateSetup(context, 'newsetup', {
            items: [
                {
                    itemId: 'catalog',
                    unsupported: false,
                    shapekeys: [{ name: 'Updated', value: 0.5 }],
                },
            ],
        })
        expect(readShapes()).toEqual([{ name: 'Updated', value: 0.5 }])

        expect(database.sqlite.prepare('SELECT item_id FROM setup_entries').all()).toEqual([
            { item_id: 'catalog' },
        ])

        const entry = database.sqlite
            .prepare('SELECT id FROM setup_entries WHERE setup_id = ?')
            .get('newsetup') as { id: string }
        database.sqlite
            .prepare(
                'INSERT INTO setup_images (stable_id, setup_id, object_key, width, height) VALUES (?, ?, ?, ?, ?)',
            )
            .run('image', 'newsetup', 'setup/user/image.jpg', 640, 480)
        database.sqlite
            .prepare(
                'INSERT INTO setup_image_points (id, setup_id, image_id, setup_entry_id, x, y) VALUES (?, ?, ?, ?, ?, ?)',
            )
            .run('point', 'newsetup', 'image', entry.id, 0.5, 0.5)
        await updateSetup(context, 'newsetup', {
            images: [],
            items: [{ id: entry.id, itemId: 'catalog', unsupported: false }],
        })
        expect(database.sqlite.prepare('SELECT id FROM setup_image_points').all()).toEqual([])
        expect(database.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
        vi.unstubAllGlobals()
        database.sqlite.close()
    }
})
