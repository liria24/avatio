import { DatabaseSync } from 'node:sqlite'

import {
    convertCloudflareMigrationHistoryCopy,
    readCommittedCloudflareMigrations,
} from '../../scripts/cloudflareMigrationHistory'

const files = readCommittedCloudflareMigrations()
const prefixEnd = files.findIndex((file) => file.name.startsWith('20260910151556_'))
const parentRebuild = files.findIndex((file) => file.name.startsWith('20261002210002_'))

const applyPending = (database: DatabaseSync) => {
    const applied = new Set(
        database
            .prepare('SELECT name FROM d1_migrations')
            .all()
            .map((row) => row.name),
    )
    let appliedCount = 0
    for (const file of files.filter((file) => !applied.has(file.name))) {
        database.exec('BEGIN')
        try {
            // This models pinned cf's SQL-file + bookkeeping INSERT transaction, without remote access.
            database.exec(file.sql)
            database.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(file.name)
            database.exec('COMMIT')
            appliedCount++
        } catch (error) {
            database.exec('ROLLBACK')
            throw error
        }
    }
    return appliedCount
}

describe('isolated cf ledger transition with synthetic populated SQLite', () => {
    let database: DatabaseSync
    beforeEach(() => {
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON')
    })
    afterEach(() => database.close())

    it.each([prefixEnd, parentRebuild])(
        'retains child rows and applies only pending files once from cutoff %i',
        (cutoff) => {
            expect(cutoff).toBeGreaterThan(0)
            database.exec(`CREATE TABLE __alchemy_migrations (
            id INTEGER PRIMARY KEY, name TEXT, hash TEXT NOT NULL, applied_at TEXT
        ); CREATE TABLE d1_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`)
            for (const [index, file] of files.slice(0, cutoff).entries()) {
                database.exec('BEGIN')
                database.exec(file.sql)
                database
                    .prepare(
                        'INSERT INTO __alchemy_migrations (name, hash, applied_at) VALUES (?, ?, ?)',
                    )
                    .run(
                        index === 0 ? file.name : file.name.replace('/migration.sql', ''),
                        file.hash,
                        '2026-01-01 00:00:00',
                    )
                database.exec('COMMIT')
            }
            database
                .prepare('INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)')
                .run(files[0]!.name, '2026-01-01 00:00:00')
            database.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('fixture-owner', 'Fixture Owner', 'fixture_owner', 'Fixture Owner', 'owner@example.invalid');
            INSERT INTO sessions (id, token, user_id, expires_at)
            VALUES ('fixture-session', 'synthetic-session', 'fixture-owner', 9999999999999);
            INSERT INTO setups (id, user_id, name) VALUES ('fixture-setup', 'fixture-owner', 'Fixture Setup');
            INSERT INTO catalog_items (id) VALUES ('fixture-item');
            INSERT INTO setup_entries (id, setup_id, item_id) VALUES ('fixture-entry', 'fixture-setup', 'fixture-item');
            INSERT INTO setup_images (id, setup_id, object_key, width, height, theme_colors, content_type, size, etag, created_at)
            VALUES (7, 'fixture-setup', 'setup/fixture.png', 800, 600, '["#123456"]', 'image/png', 123, 'fixture-etag', 456);
        `)
            if (cutoff === parentRebuild)
                database.exec(`
            INSERT INTO setup_image_points (id, setup_id, image_id, setup_entry_id, x, y)
            VALUES ('fixture-point', 'fixture-setup', '7', 'fixture-entry', 0.25, 0.75);
        `)
            const authBefore = database.prepare('SELECT * FROM sessions').all()
            const setupsBefore = database.prepare('SELECT * FROM setups').all()
            const imagesBefore = database.prepare('SELECT * FROM setup_images').all()
            const oldHistory = database.prepare('SELECT * FROM __alchemy_migrations').all()
            expect(convertCloudflareMigrationHistoryCopy(database, files)).toEqual({
                importedCount: cutoff - 1,
                pendingCount: files.length - cutoff,
            })
            expect(database.prepare('SELECT * FROM sessions').all()).toEqual(authBefore)
            expect(database.prepare('SELECT * FROM setups').all()).toEqual(setupsBefore)
            expect(database.prepare('SELECT * FROM setup_images').all()).toEqual(imagesBefore)
            expect(convertCloudflareMigrationHistoryCopy(database, files).importedCount).toBe(0)
            expect(applyPending(database)).toBe(files.length - cutoff)
            expect(applyPending(database)).toBe(0)
            expect(database.prepare('SELECT * FROM __alchemy_migrations').all()).toEqual(oldHistory)
            expect(database.prepare('SELECT * FROM sessions').all()).toEqual(authBefore)
            expect(database.prepare('SELECT * FROM setups').all()).toEqual(setupsBefore)
            expect(database.prepare('SELECT * FROM setup_images').all()).toEqual(
                imagesBefore.map((row) => ({
                    position: 0,
                    ...row,
                    stable_id: row.stable_id ?? '7',
                })),
            )
            if (cutoff === parentRebuild)
                expect(database.prepare('SELECT id FROM setup_image_points').all()).toEqual([
                    { id: 'fixture-point' },
                ])
            expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
            expect(database.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1)
        },
    )

    it('applies all historical SQL once to a clean Preview-shaped DB', () => {
        database.exec(`CREATE TABLE d1_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`)
        expect(applyPending(database)).toBe(files.length)
        expect(applyPending(database)).toBe(0)
        expect(database.prepare('SELECT count(*) AS count FROM d1_migrations').get()?.count).toBe(
            files.length,
        )
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    })

    it('does not create a cf ledger or alter data when a recorded hash changed', () => {
        database.exec(`CREATE TABLE __alchemy_migrations (name TEXT, hash TEXT, applied_at TEXT, id INTEGER PRIMARY KEY);
            INSERT INTO __alchemy_migrations (name, hash, applied_at) VALUES ('unknown', 'changed', '2026-01-01');`)
        const before = database.prepare('SELECT * FROM __alchemy_migrations').all()
        expect(() => convertCloudflareMigrationHistoryCopy(database, files)).toThrow()
        expect(database.prepare('SELECT * FROM __alchemy_migrations').all()).toEqual(before)
        expect(database.prepare('PRAGMA table_info(d1_migrations)').all()).toEqual([])
    })
})
