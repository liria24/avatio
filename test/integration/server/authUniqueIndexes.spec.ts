import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

it('adds the missing auth uniqueness without rebuilding parents or altering duplicate data', () => {
    const migrations = readdirSync('drizzle').sort()
    const target = migrations.findIndex((name) => name.endsWith('_auth-unique-indexes'))
    expect(target).toBeGreaterThan(0)
    const db = new DatabaseSync(':memory:')
    try {
        db.exec('PRAGMA foreign_keys = ON')
        for (const name of migrations.slice(0, target))
            db.exec(readFileSync(join('drizzle', name, 'migration.sql'), 'utf8'))
        db.exec(`
            INSERT INTO users (id, name, username, display_username, email) VALUES
                ('owner', 'Owner', 'owner', 'owner', 'shared@example.test'),
                ('duplicate', 'Other', 'other', 'other', 'shared@example.test');
            INSERT INTO sessions (id, token, user_id, expires_at) VALUES ('session', 'synthetic', 'owner', 9999999999999);
            INSERT INTO setups (id, name, user_id) VALUES ('setup', 'Setup', 'owner');
            INSERT INTO user_settings (id, user_id) VALUES ('settings', 'owner');
        `)
        const migration = readFileSync(
            join('drizzle', migrations[target]!, 'migration.sql'),
            'utf8',
        )
        const apply = () => {
            db.exec('BEGIN')
            try {
                db.exec(migration)
                db.exec('COMMIT')
            } catch (error) {
                db.exec('ROLLBACK')
                throw error
            }
        }
        expect(apply).toThrow(/UNIQUE constraint/)
        expect(db.prepare('SELECT count(*) AS count FROM users').get()).toMatchObject({ count: 2 })
        expect(
            db.prepare("SELECT name FROM sqlite_schema WHERE name = 'user_email_index'").get(),
        ).toBeDefined()
        expect(
            db
                .prepare(
                    "SELECT name FROM sqlite_schema WHERE name = 'user_settings_user_id_unique'",
                )
                .get(),
        ).toBeUndefined()
        db.exec(
            "UPDATE users SET email = 'other@example.test' WHERE id = 'duplicate'; INSERT INTO user_settings (id, user_id) VALUES ('duplicate-settings', 'owner');",
        )
        expect(apply).toThrow(/UNIQUE constraint/)
        expect(db.prepare('SELECT count(*) AS count FROM user_settings').get()).toMatchObject({
            count: 2,
        })
        db.exec("DELETE FROM user_settings WHERE id = 'duplicate-settings'")
        apply()
        expect(db.prepare('SELECT token FROM sessions').get()).toMatchObject({ token: 'synthetic' })
        expect(db.prepare('SELECT id FROM setups').get()).toMatchObject({ id: 'setup' })
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        expect(() =>
            db.exec("UPDATE users SET email = 'shared@example.test' WHERE id = 'duplicate'"),
        ).toThrow(/UNIQUE constraint/)
        expect(() =>
            db.exec("INSERT INTO user_settings (id, user_id) VALUES ('again', 'owner')"),
        ).toThrow(/UNIQUE constraint/)
    } finally {
        db.close()
    }
})
