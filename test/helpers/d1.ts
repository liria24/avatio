import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import type { D1Database } from '@cloudflare/workers-types'

const migrations = readdirSync('drizzle')
    .sort()
    .map((directory) => readFileSync(join('drizzle', directory, 'migration.sql'), 'utf8'))
    .join('\n')

/** Exercise actual Drizzle SQL and atomic D1 batches without remote credentials. */
export const createTestD1 = () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys = ON')
    sqlite.exec(migrations)
    const prepare = (query: string, parameters: SQLInputValue[] = []) => ({
        bind: (...values: SQLInputValue[]) => prepare(query, values),
        async all() {
            const results = sqlite.prepare(query).all(...parameters)
            return {
                success: true,
                results,
                meta: { changes: Number(sqlite.prepare('SELECT changes() AS count').get()!.count) },
            }
        },
        async raw() {
            const statement = sqlite.prepare(query)
            statement.setReturnArrays(true)
            return statement.all(...parameters)
        },
        async first() {
            return sqlite.prepare(query).get(...parameters) ?? null
        },
        async run() {
            return this.all()
        },
    })
    const client = {
        prepare,
        async batch(statements: ReturnType<typeof prepare>[]) {
            sqlite.exec('BEGIN')
            try {
                const results = []
                for (const statement of statements) results.push(await statement.all())
                sqlite.exec('COMMIT')
                return results
            } catch (error) {
                sqlite.exec('ROLLBACK')
                throw error
            }
        },
    }
    return { sqlite, binding: client as unknown as D1Database }
}
