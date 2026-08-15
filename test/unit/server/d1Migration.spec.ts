import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationSql = readdirSync('drizzle')
    .sort()
    .map((directory) => readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
    .join('\n')

describe('D1 migration', () => {
    let database: DatabaseSync

    beforeEach(() => {
        database = new DatabaseSync(':memory:')
        database.exec('PRAGMA foreign_keys = ON;')
        database.exec(migrationSql)
    })

    afterEach(() => database.close())

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
})
