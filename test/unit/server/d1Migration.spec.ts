import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { setupDraftContentSchema } from '@avatio/core/setups'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationSql = readdirSync('drizzle')
    .sort()
    .map((directory) => readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
    .join('\n')
const setupDraftContentMigrationSql = readFileSync(
    'drizzle/20260830123639_setup-draft-v2-content/migration.sql',
    'utf8',
)
const authMigrationDirectory = '20260906124049_better-auth-1-7-3'

describe('D1 migration', () => {
    let database: DatabaseSync

    beforeEach(() => {
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON;')
        database.exec(migrationSql)
    })

    afterEach(() => database.close())

    it('preserves existing follows and preferences when applying user relations', () => {
        database.close()
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON')
        const migration = '20260908052031_user-relations'
        for (const directory of readdirSync('drizzle').sort()) {
            if (directory >= migration) break
            database.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
        }
        database.exec(`
            INSERT INTO users (id, name, username, display_username, email) VALUES
                ('follower', 'Follower', 'follower', 'Follower', 'follower@example.com'),
                ('author', 'Author', 'author', 'Author', 'author@example.com');
            INSERT INTO follow_users (user_id, target_user_id) VALUES ('follower', 'author');
            INSERT INTO user_settings (user_id, show_private_setups, show_nsfw) VALUES ('follower', 0, 1);
            BEGIN;
        `)
        database.exec(readFileSync(join('drizzle', migration, 'migration.sql'), 'utf8'))
        database.exec('COMMIT')
        expect(
            database.prepare('SELECT user_id, followee_id FROM user_follows').get(),
        ).toMatchObject({ user_id: 'follower', followee_id: 'author' })
        expect(database.prepare('SELECT * FROM user_settings').get()).toMatchObject({
            show_private_setups: 0,
            show_nsfw: 1,
            public_bookmarks: 0,
            public_followees: 1,
            notif_site_enabled: 1,
        })
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    })

    it('preserves existing auth data and accepts provider-scoped accounts after 1.7.3 migration', () => {
        database.close()
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON')
        for (const directory of readdirSync('drizzle').sort()) {
            if (directory >= authMigrationDirectory) break
            database.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
        }
        database.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('auth-user', 'Auth User', 'auth_user', 'Auth User', 'auth@example.com');
            INSERT INTO accounts (id, issuer, provider_account_id, provider_id, user_id, access_token, refresh_token, created_at, updated_at)
            VALUES ('old-account', 'https://api.twitter.com', 'provider-user', 'twitter', 'auth-user', 'existing-access', 'existing-refresh', 1, 2);
            INSERT INTO sessions (id, token, user_id, expires_at)
            VALUES ('old-session', 'existing-session', 'auth-user', 9999999999999);
        `)
        // D1 applies migrations in a transaction, where foreign_keys=OFF is ineffective.
        database.exec('BEGIN')
        database.exec(
            readFileSync(join('drizzle', authMigrationDirectory, 'migration.sql'), 'utf8'),
        )
        database.exec('COMMIT')
        expect(
            database.prepare('SELECT * FROM accounts WHERE id = ?').get('old-account'),
        ).toMatchObject({
            issuer: 'https://api.twitter.com',
            provider_account_id: 'provider-user',
            provider_id: 'twitter',
            user_id: 'auth-user',
            access_token: 'existing-access',
            refresh_token: 'existing-refresh',
            created_at: 1,
            updated_at: 2,
        })
        expect(database.prepare('SELECT token FROM sessions').get()).toMatchObject({
            token: 'existing-session',
        })
        const insert = database.prepare(`
            INSERT INTO accounts (id, provider_account_id, provider_id, user_id, created_at, updated_at)
            VALUES (?, 'provider-user', ?, 'auth-user', 3, 4)
        `)
        insert.run('new-account', 'credential')
        expect(() => insert.run('duplicate-account', 'twitter')).toThrow(/UNIQUE constraint failed/)
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    })

    it('migrates report IDs and accepts reports from both Workers during the contract transition', () => {
        database.close()
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON')
        const prepare = '20260908022206_prepare_catalog_report_contract'
        const backfill = '20260908022217_backfill_catalog_report_ids'
        for (const directory of readdirSync('drizzle').sort()) {
            if (directory >= prepare) break
            database.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
        }
        database.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('reporter', 'Reporter', 'reporter', 'Reporter', 'reporter@example.com');
            INSERT INTO items (id, platform, name, category) VALUES ('123', 'booth', 'Avatar', 'avatar');
            INSERT INTO catalog_items (id) VALUES ('catalog');
            INSERT INTO item_sources (id, item_id, provider_key, external_id, canonical_url, display_name)
            VALUES ('source', 'catalog', 'booth', '123', 'https://booth.pm/items/123', 'Avatar');
            INSERT INTO item_reports (id, reporter_id, item_id, comment) VALUES (41, 'reporter', '123', 'Keep report');
        `)
        for (const directory of [prepare, backfill]) {
            database.exec('BEGIN')
            database.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
            database.exec('COMMIT')
        }
        expect(
            database
                .prepare('SELECT id, item_id, catalog_item_id, comment FROM item_reports')
                .get(),
        ).toEqual({
            id: 41,
            item_id: '123',
            catalog_item_id: 'catalog',
            comment: 'Keep report',
        })
        database.exec(`
            INSERT INTO item_reports (reporter_id, item_id) VALUES ('reporter', '123');
            INSERT INTO item_reports (reporter_id, catalog_item_id) VALUES ('reporter', 'catalog');
        `)
        expect(
            database.prepare('SELECT catalog_item_id FROM item_reports ORDER BY id').all(),
        ).toEqual([
            { catalog_item_id: 'catalog' },
            { catalog_item_id: 'catalog' },
            { catalog_item_id: 'catalog' },
        ])
        database.exec(
            "INSERT INTO items (id, platform, name, category) VALUES ('unmapped', 'booth', 'Unmapped', 'avatar')",
        )
        expect(() =>
            database.exec(
                "INSERT INTO item_reports (reporter_id, item_id) VALUES ('reporter', 'unmapped')",
            ),
        ).toThrow('Missing CatalogItem for report')
        expect(database.prepare('SELECT count(*) AS count FROM item_reports').get()).toEqual({
            count: 3,
        })
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    })

    it('preserves existing drafts and image references through transactional schema and content migrations', () => {
        database.close()
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON')
        const draftSchemaMigration = '20260830123630_normal_piledriver'
        const directories = readdirSync('drizzle').sort()
        for (const directory of directories) {
            if (directory >= draftSchemaMigration) break
            database.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
        }
        database.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('draft-owner', 'Owner', 'draft_owner', 'Owner', 'owner@example.com');
            INSERT INTO setups (id, user_id, name) VALUES ('draft-setup', 'draft-owner', 'Setup');
            INSERT INTO idempotency_requests (id, scope, route, key, request_hash, lease_expires_at, expires_at)
            VALUES ('draft-request', 'draft-owner', '/api/setup-drafts', 'key', 'hash', 1, 2);
            INSERT INTO setup_drafts (id, user_id, setup_id, idempotency_request_id, content)
            VALUES ('draft', 'draft-owner', 'draft-setup', 'draft-request', '{"name":"Draft","images":["https://images.avatio.me/setup/draft.png"],"tags":[{"tag":"avatar"}]}');
            INSERT INTO setup_draft_images (id, setup_draft_id, object_key)
            VALUES ('draft-image', 'draft', 'setup/draft.png');
        `)
        for (const directory of directories.filter((entry) => entry >= draftSchemaMigration)) {
            // D1 keeps foreign keys enabled for every migration transaction.
            database.exec('BEGIN')
            database.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
            database.exec('COMMIT')
        }

        const draft = database.prepare('SELECT * FROM setup_drafts WHERE id = ?').get('draft')
        expect(draft).toMatchObject({
            user_id: 'draft-owner',
            setup_id: 'draft-setup',
            revision: 1,
        })
        expect(draft).not.toHaveProperty('idempotency_request_id')
        expect(setupDraftContentSchema.parse(JSON.parse(String(draft?.content)))).toMatchObject({
            name: 'Draft',
            images: ['https://images.avatio.me/setup/draft.png'],
            tags: ['avatar'],
        })
        expect(database.prepare('SELECT * FROM setup_draft_images').all()).toEqual([
            { id: 'draft-image', setup_draft_id: 'draft', object_key: 'setup/draft.png' },
        ])
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])

        database.exec("DELETE FROM setups WHERE id = 'draft-setup'")
        expect(database.prepare('SELECT * FROM setup_drafts').all()).toEqual([])
        expect(database.prepare('SELECT * FROM setup_draft_images').all()).toEqual([])
    })

    it('contracts legacy tables atomically while preserving reports, drafts, images, auth and v2 relations', () => {
        database.close()
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON')
        const contract = '20260908033156_contract_catalog_and_preserve_data'
        for (const directory of readdirSync('drizzle').sort()) {
            if (directory >= contract) break
            database.exec(readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
        }
        database.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('owner', 'Owner', 'owner', 'Owner', 'owner@example.com');
            INSERT INTO accounts (id, issuer, provider_account_id, provider_id, user_id, access_token, refresh_token, created_at, updated_at)
            VALUES ('account', 'old-issuer', 'provider-user', 'twitter', 'owner', 'test-access', 'test-refresh', 1, 2);
            INSERT INTO sessions (id, token, user_id, expires_at)
            VALUES ('session', 'test-session', 'owner', 9999999999999);
            INSERT INTO shops (id, platform, name) VALUES ('creator', 'booth', 'Creator');
            INSERT INTO user_shops (user_id, shop_id) VALUES ('owner', 'creator');
            INSERT INTO user_shop_verifications (id, code, user_id) VALUES ('old-challenge', 'old-code', 'owner');
            INSERT INTO items (id, platform, name, category, shop_id) VALUES ('123', 'booth', 'Avatar', 'avatar', 'creator');
            INSERT INTO catalog_items (id, display_name_override, category_override, category_override_origin)
            VALUES ('catalog', 'Curated', 'hair', 'manual');
            INSERT INTO item_sources (id, item_id, provider_key, external_id, canonical_url, display_name)
            VALUES ('source', 'catalog', 'booth', '123', 'https://booth.pm/items/123', 'Avatar');
            INSERT INTO publishers (id, display_name_override) VALUES ('publisher', 'Creator');
            INSERT INTO publisher_sources (id, publisher_id, provider_key, external_id, canonical_url, name)
            VALUES ('publisher-source', 'publisher', 'booth', 'creator', 'https://creator.booth.pm', 'Creator');
            INSERT INTO publisher_source_ownerships (id, user_id, publisher_source_id, method, verified_at)
            VALUES ('ownership', 'owner', 'publisher-source', 'profile-link', 1);
            INSERT INTO user_publishers (id, user_id, publisher_id) VALUES ('user-publisher', 'owner', 'publisher');
            INSERT INTO setups (id, user_id, name, public) VALUES ('174', 'owner', 'Private', 0);
            INSERT INTO setup_items (id, setup_id, item_id, note) VALUES ('legacy-entry', '174', '123', 'Legacy note');
            INSERT INTO setup_item_shapekeys (setup_item_id, name, value) VALUES ('legacy-entry', 'Smile', 0.25);
            INSERT INTO setup_entries (id, setup_id, item_id, category_override, note, unsupported)
            VALUES ('entry', '174', 'catalog', 'avatar', 'Keep entry note', 1);
            INSERT INTO setup_entry_shapekeys (id, setup_entry_id, name, value) VALUES (1, 'entry', 'Smile', 0.75);
            INSERT INTO item_reports (id, reporter_id, item_id, comment, name_error)
            VALUES (41, 'owner', '123', 'Keep report', 1);
        `)
        const content = {
            public: false,
            name: 'Keep draft',
            description: 'Keep description',
            images: ['https://images.avatio.me/setup/draft.png'],
            imageMetadata: {},
            tags: ['tag'],
            coauthors: [],
            items: [
                {
                    itemId: '123',
                    category: 'avatar',
                    note: 'Keep note',
                    unsupported: false,
                    shapekeys: [{ name: 'Smile', value: 0.25 }],
                },
                { itemId: 'catalog', category: 'tool', note: '', unsupported: true, shapekeys: [] },
                {
                    itemId: 'unresolved-reference',
                    category: 'other',
                    note: 'Keep unresolved entry',
                    unsupported: false,
                    shapekeys: [],
                },
            ],
        }
        database
            .prepare(
                'INSERT INTO setup_drafts (id, user_id, setup_id, content, revision) VALUES (?, ?, ?, ?, ?)',
            )
            .run('draft', 'owner', '174', JSON.stringify(content), 3)
        database.exec(
            "INSERT INTO setup_draft_images (id, setup_draft_id, object_key) VALUES ('draft-image', 'draft', 'setup/draft.png')",
        )
        const images = database.prepare('SELECT * FROM setup_draft_images').all()
        const preservedTables = [
            'sessions',
            'setups',
            'setup_entries',
            'setup_entry_shapekeys',
            'catalog_items',
            'item_sources',
            'publishers',
            'publisher_sources',
            'publisher_source_ownerships',
            'user_publishers',
        ]
        const preservedRows = preservedTables.map((table) =>
            database.prepare(`SELECT * FROM ${table}`).all(),
        )
        const sql = readFileSync(join('drizzle', contract, 'migration.sql'), 'utf8')

        // An error after parent-table rebuilds must restore the original data and schema.
        database.exec('BEGIN')
        expect(() =>
            database.exec(
                sql.replace(
                    '-- END GENERATED SCHEMA DDL',
                    'INSERT INTO _catalog_contract_check VALUES (1);',
                ),
            ),
        ).toThrow(/CHECK constraint/)
        database.exec('ROLLBACK')
        expect(database.prepare('SELECT * FROM setup_draft_images').all()).toEqual(images)
        expect(database.prepare('SELECT issuer FROM accounts').get()).toMatchObject({
            issuer: 'old-issuer',
        })
        expect(database.prepare('SELECT item_id FROM item_reports').get()).toMatchObject({
            item_id: '123',
        })

        database.exec('BEGIN')
        database.exec(sql)
        database.exec('COMMIT')
        expect(database.prepare('SELECT * FROM setup_draft_images').all()).toEqual(images)
        expect(
            preservedTables.map((table) => database.prepare(`SELECT * FROM ${table}`).all()),
        ).toEqual(preservedRows)
        expect(database.prepare('SELECT * FROM accounts').get()).toMatchObject({
            id: 'account',
            provider_account_id: 'provider-user',
            provider_id: 'twitter',
            user_id: 'owner',
            access_token: 'test-access',
            refresh_token: 'test-refresh',
            created_at: 1,
            updated_at: 2,
        })
        expect(database.prepare('SELECT * FROM item_reports').get()).toMatchObject({
            id: 41,
            reporter_id: 'owner',
            catalog_item_id: 'catalog',
            comment: 'Keep report',
            name_error: 1,
        })
        const draft = database.prepare('SELECT content, revision FROM setup_drafts').get()
        expect(draft?.revision).toBe(3)
        expect(JSON.parse(String(draft?.content))).toEqual({
            ...content,
            items: content.items.map((item, index) =>
                index === 0 ? { ...item, itemId: 'catalog' } : item,
            ),
        })
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        const tables = database
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all()
            .map((row) => row.name)
        for (const name of [
            'items',
            'shops',
            'item_category_overrides',
            'setup_items',
            'setup_item_shapekeys',
            'user_shops',
            'user_shop_verifications',
            'catalog_migration_runs',
        ])
            expect(tables).not.toContain(name)
        expect(
            tables.some(
                (name) =>
                    String(name).startsWith('_contract_') || name === '_catalog_contract_check',
            ),
        ).toBe(false)
    })

    it('enforces idempotency and relation uniqueness', () => {
        const insertRequest = database.prepare(`
            INSERT INTO idempotency_requests
                (id, scope, route, key, request_hash, lease_expires_at, expires_at)
            VALUES (?, 'user:1', '/api/feedbacks', 'key', 'hash', 1, 2)
        `)
        insertRequest.run('request-1')
        expect(() => insertRequest.run('request-2')).toThrow(/UNIQUE constraint failed/)

        const insertUser = database.prepare(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES (?, ?, ?, ?, ?)
        `)
        insertUser.run('user-1', 'One', 'one', 'One', 'one@example.com')
        insertUser.run('user-2', 'Two', 'two', 'Two', 'two@example.com')
        const follow = database.prepare(
            'INSERT INTO user_follows (user_id, followee_id) VALUES (?, ?)',
        )
        follow.run('user-1', 'user-2')
        expect(() => follow.run('user-1', 'user-2')).toThrow(/UNIQUE constraint failed/)

        const mute = database.prepare('INSERT INTO user_mutes (user_id, mutee_id) VALUES (?, ?)')
        mute.run('user-1', 'user-2')
        expect(() => mute.run('user-1', 'user-2')).toThrow(/UNIQUE constraint failed/)
    })

    it('rolls back all business writes when a batch statement fails', () => {
        database.exec(`
            INSERT INTO idempotency_requests
                (id, scope, route, key, request_hash, lease_expires_at, expires_at)
            VALUES ('request-1', 'fingerprint:1', '/api/feedbacks', 'key', 'hash', 1, 2)
        `)

        database.exec('BEGIN')
        try {
            database.exec(`
                INSERT INTO feedbacks (fingerprint, comment, idempotency_request_id)
                VALUES ('fingerprint', 'first', 'request-1');
                INSERT INTO feedbacks (fingerprint, comment, idempotency_request_id)
                VALUES ('fingerprint', 'second', 'request-1');
            `)
            database.exec('COMMIT')
        } catch {
            database.exec('ROLLBACK')
        }

        const row = database.prepare('SELECT COUNT(*) AS count FROM feedbacks').get() as {
            count: number
        }
        expect(row.count).toBe(0)
    })

    it('round-trips JSON, booleans, timestamps, and SQLite LIKE', () => {
        const timestamp = Date.now()
        database
            .prepare(`
                INSERT INTO users
                    (id, name, username, display_username, email, email_verified, created_at, updated_at, links)
                VALUES ('user-1', 'Test User', 'test_user', 'Test User', 'test@example.com', 1, ?, ?, ?)
            `)
            .run(timestamp, timestamp, JSON.stringify(['https://example.com']))

        const row = database
            .prepare("SELECT email_verified, created_at, links FROM users WHERE name LIKE '%test%'")
            .get() as { email_verified: number; created_at: number; links: string }
        expect(row).toEqual({
            email_verified: 1,
            created_at: timestamp,
            links: JSON.stringify(['https://example.com']),
        })
    })

    it('fully converts legacy Setup Draft JSON to the v2 form shape', () => {
        database.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('draft-user', 'Draft User', 'draft_user', 'Draft User', 'draft@example.com');
        `)
        const legacy = {
            public: false,
            name: 'Legacy',
            description: null,
            tags: [{ tag: 'avatar' }],
            coauthors: [{ userId: 'coauthor', username: 'friend', note: null }],
            items: [{ itemId: 42, category: null, unsupported: true }],
        }
        database
            .prepare('INSERT INTO setup_drafts (id, user_id, content) VALUES (?, ?, ?)')
            .run('00000000-0000-4000-8000-000000000001', 'draft-user', JSON.stringify(legacy))

        database.exec(setupDraftContentMigrationSql)
        const row = database
            .prepare('SELECT revision, content FROM setup_drafts WHERE user_id = ?')
            .get('draft-user') as { revision: number; content: string }
        expect(row.revision).toBe(1)
        expect(setupDraftContentSchema.parse(JSON.parse(row.content))).toEqual({
            public: false,
            name: 'Legacy',
            description: '',
            images: [],
            imageMetadata: {},
            tags: ['avatar'],
            coauthors: [{ userId: 'coauthor', username: 'friend', note: '' }],
            items: [
                {
                    itemId: '42',
                    category: 'other',
                    note: '',
                    unsupported: true,
                    shapekeys: [],
                },
            ],
        })
    })

    it('removes setup draft image references with their draft', () => {
        database.exec(`
            INSERT INTO users (id, name, username, display_username, email)
            VALUES ('image-user', 'Image User', 'image_user', 'Image User', 'image@example.com');
            INSERT INTO setup_drafts (id, user_id, content)
            VALUES ('00000000-0000-4000-8000-000000000002', 'image-user', '{}');
            INSERT INTO setup_draft_images (id, setup_draft_id, object_key)
            VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'setup/image.png');
            DELETE FROM setup_drafts WHERE id = '00000000-0000-4000-8000-000000000002';
        `)

        expect(database.prepare('SELECT COUNT(*) AS count FROM setup_draft_images').get()).toEqual({
            count: 0,
        })
    })
})
