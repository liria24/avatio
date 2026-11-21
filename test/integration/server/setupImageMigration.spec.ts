import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const directories = readdirSync('drizzle').sort()
const imageFeature = '20260910151556'
const backfill = '20261002210002_setup-image-stable-id-backfill'
const migrate = (db: DatabaseSync, directory: string) => {
    db.exec('BEGIN')
    try {
        db.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
        db.exec('COMMIT')
    } catch (error) {
        db.exec('ROLLBACK')
        throw error
    }
}

describe('required stable Setup image IDs', () => {
    let db: DatabaseSync
    beforeEach(() => {
        db = new DatabaseSync(':memory:')
        db.exec('PRAGMA foreign_keys = ON')
    })
    afterEach(() => db.close())

    it.each([imageFeature, backfill])(
        'preserves populated images when upgrading from before %s',
        (cutoff) => {
            for (const directory of directories.filter((directory) => directory < cutoff))
                migrate(db, directory)
            db.exec(`
            INSERT INTO users (id, name, username, display_username, email) VALUES ('owner', 'Owner', 'owner', 'Owner', 'owner@example.com');
            INSERT INTO setups (id, user_id, name) VALUES ('setup', 'owner', 'Setup');
            INSERT INTO catalog_items (id) VALUES ('item');
            INSERT INTO setup_entries (id, setup_id, item_id) VALUES ('entry', 'setup', 'item');
            INSERT INTO setup_images (id, setup_id, object_key, width, height, theme_colors, content_type, size, etag, created_at)
            VALUES (7, 'setup', 'setup/legacy.png', 800, 600, '["#123456"]', 'image/png', 123, 'etag', 456);
        `)
            if (cutoff === backfill)
                db.exec(`
            UPDATE setup_images SET position = 1 WHERE id = 7;
            INSERT INTO setup_images (id, stable_id, setup_id, position, object_key, width, height)
            VALUES (8, 'existing-id', 'setup', 0, 'setup/existing.png', 640, 480);
            INSERT INTO setup_image_points (id, setup_id, image_id, setup_entry_id, x, y)
            VALUES ('legacy-point', 'setup', '7', 'entry', 0.25, 0.75), ('existing-point', 'setup', 'existing-id', 'entry', 0.5, 0.5);
        `)
            const before = db.prepare('SELECT * FROM setup_images ORDER BY id').all()
            const points =
                cutoff === backfill
                    ? db.prepare('SELECT * FROM setup_image_points ORDER BY id').all()
                    : []
            for (const directory of directories.filter((directory) => directory >= cutoff))
                migrate(db, directory)
            expect(db.prepare('SELECT * FROM setup_images ORDER BY id').all()).toEqual(
                before.map((row) => ({
                    position: 0,
                    ...row,
                    stable_id: row.stable_id ?? String(row.id),
                })),
            )
            expect(db.prepare('SELECT * FROM setup_image_points ORDER BY id').all()).toEqual(points)
            expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
            migrate(db, backfill)
            expect(db.prepare('SELECT stable_id FROM setup_images WHERE id = 7').get()).toEqual({
                stable_id: '7',
            })
            expect(() =>
                db.exec(
                    "INSERT INTO setup_images (setup_id, object_key, width, height) VALUES ('setup', 'new', 1, 1)",
                ),
            ).toThrow(/NOT NULL/)
            expect(() =>
                db.exec(
                    "INSERT INTO setup_images (stable_id, setup_id, object_key, width, height) VALUES ('7', 'setup', 'new', 1, 1)",
                ),
            ).toThrow(/UNIQUE/)
        },
    )

    it('migrates an empty database and requires unique stable IDs', () => {
        for (const directory of directories) migrate(db, directory)
        expect(
            db
                .prepare('PRAGMA table_info(setup_images)')
                .all()
                .find((row) => row.name === 'stable_id'),
        ).toMatchObject({ notnull: 1 })
        expect(db.prepare('SELECT * FROM setup_images').all()).toEqual([])
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    })

    it('fails and rolls back a backfill collision without renumbering either image', () => {
        for (const directory of directories.filter((directory) => directory < backfill))
            migrate(db, directory)
        db.exec(`
            INSERT INTO users (id, name, username, display_username, email) VALUES ('owner', 'Owner', 'owner', 'Owner', 'owner@example.com');
            INSERT INTO setups (id, user_id, name) VALUES ('setup', 'owner', 'Setup');
            INSERT INTO setup_images (id, stable_id, setup_id, object_key, width, height)
            VALUES (6, NULL, 'setup', 'a', 1, 1), (7, NULL, 'setup', 'b', 1, 1), (8, '7', 'setup', 'c', 1, 1);
        `)
        const before = db.prepare('SELECT * FROM setup_images').all()
        expect(() => migrate(db, backfill)).toThrow(/UNIQUE/)
        expect(db.prepare('SELECT * FROM setup_images').all()).toEqual(before)
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    })
})
