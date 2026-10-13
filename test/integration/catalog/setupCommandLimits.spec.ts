import { createError, type H3Event } from '@nuxt/nitro-server/h3'
import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { setupEntries, setupEntryShapekeys, setupImagePoints } from '../../../database/schema'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import { completeIdempotencyRequest } from '../../../server/utils/idempotency'
import { createSetup, updateSetup } from '../../../server/utils/setupCommands'
import { resolveSetupImageData } from '../../../server/utils/setupImages'
import { setupsInsertSchema, setupsUpdateSchema } from '../../../shared/types/database'
import { createTestD1 } from '../../helpers/d1'

let database: ReturnType<typeof createTestD1>
const claim = {
    id: 'request',
    key: 'key',
    resourceId: 'setup',
    replay: false,
    response: null,
    statusCode: null,
}
const batch = vi.fn(executeAppBatch)

beforeEach(() => {
    database = createTestD1()
    batch.mockClear()
    Object.entries({
        executeAppBatch: batch,
        completeIdempotencyRequest,
        resolveSetupImageData,
        createError,
        invalidateCacheResources: vi.fn(),
        EDGE_CACHE_TAGS: {},
        querySetupProjection: async () => ({ setup: {} }),
    }).forEach(([name, value]) => vi.stubGlobal(name, value))
    database.sqlite.exec(`
        INSERT INTO users (id, name, username, display_username, email)
        VALUES ('user', 'User', 'user', 'User', 'user@example.test');
        INSERT INTO idempotency_requests (id, scope, route, key, request_hash, lease_expires_at, expires_at)
        VALUES ('request', 'user', '/api/setups', 'key', 'hash', 1, 2);
    `)
    for (let index = 0; index < 32; index++)
        database.sqlite.prepare('INSERT INTO catalog_items (id) VALUES (?)').run(`catalog-${index}`)
})
afterEach(() => {
    vi.unstubAllGlobals()
    database.sqlite.close()
})

const context = () => ({
    db: drizzle(database.binding, { relations }),
    user: { id: 'user' },
    event: {} as H3Event,
})
const input = (entries: number, shapes: number, points: number, prefix = 'entry') =>
    setupsInsertSchema.parse({
        name: 'Setup',
        public: true,
        items: Array.from({ length: entries }, (_, index) => ({
            id: `${prefix}-${index}`,
            itemId: `catalog-${index}`,
            note: 'Note',
            shapekeys: Array.from({ length: shapes }, (_, shape) => ({
                name: `Shape ${shape}`,
                value: 0.5,
            })),
        })),
        images: ['setup/user/image.png'],
        imageMetadata: {
            'setup/user/image.png': {
                id: 'image',
                objectKey: 'setup/user/image.png',
                width: 640,
                height: 480,
            },
        },
        points: Array.from({ length: points }, (_, index) => ({
            id: `point-${index}`,
            entryId: `${prefix}-${index % entries}`,
            imageId: 'image',
            x: 0.5,
            y: 0.5,
        })),
    })
const count = (table: string) =>
    database.sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get()!.count

describe('Setup commands within D1 bind limits', () => {
    it('reproduces the pinned Drizzle bind counts at the first failing INSERT sizes', () => {
        const { db } = context()
        const values = input(15, 34, 17)
        expect(
            db
                .insert(setupEntries)
                .values(
                    values.items.map((item, position) => ({
                        id: item.id!,
                        setupId: 'setup',
                        itemId: item.itemId,
                        position,
                        categoryOverride: 'other' as const,
                        note: item.note,
                        unsupported: false,
                    })),
                )
                .toSQL().params,
        ).toHaveLength(105)
        expect(
            db
                .insert(setupEntryShapekeys)
                .values(
                    values.items[0]!.shapekeys!.map((shape) => ({
                        ...shape,
                        setupEntryId: 'entry-0',
                    })),
                )
                .toSQL().params,
        ).toHaveLength(102)
        expect(
            db
                .insert(setupImagePoints)
                .values(
                    values.points.map(({ entryId, ...point }) => ({
                        ...point,
                        setupId: 'setup',
                        setupEntryId: entryId,
                    })),
                )
                .toSQL().params,
        ).toHaveLength(102)
        expect(() => database.binding.prepare('SELECT 1').bind(...Array(101).fill(1))).toThrow(
            '100 bound parameters',
        )
    })

    it.each([
        [15, 0, 0],
        [1, 34, 0],
        [1, 0, 17],
        [32, 64, 128],
    ])(
        'creates and updates %i entries / %i shapes each / %i points in one atomic batch',
        async (entries, shapes, points) => {
            const ctx = context()
            await createSetup(ctx, input(entries, shapes, points), 'setup', claim)
            expect(batch).toHaveBeenCalledTimes(1)
            expect(count('setup_entries')).toBe(entries)
            expect(count('setup_entry_shapekeys')).toBe(entries * shapes)
            expect(count('setup_image_points')).toBe(points)
            // Replace entries, retain point IDs, then update retained entries and remove points.
            await updateSetup(
                ctx,
                'setup',
                setupsUpdateSchema.parse(input(entries, shapes, points, 'replacement')),
            )
            expect(batch).toHaveBeenCalledTimes(2)
            expect(count('setup_entries')).toBe(entries)
            expect(count('setup_entry_shapekeys')).toBe(entries * shapes)
            expect(count('setup_image_points')).toBe(points)
            await updateSetup(
                ctx,
                'setup',
                setupsUpdateSchema.parse(input(entries, shapes, 0, 'replacement')),
            )
            expect(count('setup_image_points')).toBe(0)
            expect(database.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        },
    )

    it.each([99, 100, 101, 128])(
        'handles %i point IDs, retained IDs and newly added IDs without oversized IN/NOT IN',
        async (points) => {
            const ctx = context()
            await createSetup(ctx, input(1, 0, 128), 'setup', claim)
            const update = input(1, 0, points)
            await updateSetup(ctx, 'setup', update)
            expect(count('setup_image_points')).toBe(points)
            update.points = update.points.map((point, index) => ({
                ...point,
                id: index % 2 ? point.id : `new-${index}`,
                x: 0.25,
            }))
            await updateSetup(ctx, 'setup', update)
            expect(
                database.sqlite.prepare('SELECT id, x FROM setup_image_points ORDER BY id').all(),
            ).toEqual(
                update.points
                    .map(({ id, x }) => ({ id, x }))
                    .sort((a, b) => a.id.localeCompare(b.id)),
            )
        },
    )

    it('rejects a foreign point ID in a later lookup chunk before writing', async () => {
        const ctx = context()
        await createSetup(ctx, input(1, 0, 0), 'setup', claim)
        database.sqlite
            .exec(`INSERT INTO setups (id, user_id, name) VALUES ('foreign', 'user', 'Foreign');
            INSERT INTO setup_entries (id, item_id, setup_id) VALUES ('foreign-entry', 'catalog-0', 'foreign');
            INSERT INTO setup_image_points VALUES ('point-127', 'foreign', 'foreign-image', 'foreign-entry', 0.5, 0.5);`)
        await expect(updateSetup(ctx, 'setup', input(1, 0, 128))).rejects.toMatchObject({
            statusCode: 400,
        })
        expect(batch).toHaveBeenCalledTimes(1)
        expect(count('setup_image_points')).toBe(1)
    })

    it('rolls back all create chunks and idempotency completion when the final relation fails', async () => {
        const values = input(32, 64, 128)
        values.coauthors = [{ userId: 'missing-user' }]
        await expect(createSetup(context(), values, 'setup', claim)).rejects.toThrow()
        for (const table of [
            'setups',
            'setup_entries',
            'setup_entry_shapekeys',
            'setup_images',
            'setup_image_points',
        ])
            expect(count(table)).toBe(0)
        expect(
            database.sqlite.prepare('SELECT status FROM idempotency_requests').get(),
        ).toMatchObject({ status: 'pending' })
    })

    it('rolls back changed and deleted relations on a late update failure', async () => {
        const ctx = context()
        await createSetup(ctx, input(32, 64, 128), 'setup', claim)
        const snapshot = database.sqlite
            .prepare('SELECT * FROM setup_image_points ORDER BY id')
            .all()
        await expect(
            updateSetup(ctx, 'setup', {
                ...input(32, 64, 100, 'replacement'),
                name: 'Changed',
                coauthors: [{ userId: 'missing-user' }],
            }),
        ).rejects.toThrow()
        expect(database.sqlite.prepare('SELECT name FROM setups').get()).toMatchObject({
            name: 'Setup',
        })
        expect(count('setup_entries')).toBe(32)
        expect(count('setup_entry_shapekeys')).toBe(2048)
        expect(
            database.sqlite.prepare('SELECT * FROM setup_image_points ORDER BY id').all(),
        ).toEqual(snapshot)
    })
})
