import { execFile } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { Worker } from 'node:worker_threads'

import { SQLiteCatalogRepository, SQLitePublisherRepository } from '@avatio/cloudflare'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { catalogItems, itemSources } from '../../../database/schema'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'
import { initializeLocalRuntime } from '../../../server/utils/localRuntime'

describe('local SQLite runtime', () => {
    let directory: string
    let runtime: ReturnType<typeof initializeLocalRuntime>

    beforeAll(async () => {
        directory = await mkdtemp(join(tmpdir(), 'avatio-local-runtime-'))
        await cp(join(process.cwd(), 'drizzle'), join(directory, 'drizzle'), { recursive: true })
        runtime = initializeLocalRuntime(directory)
    })

    afterAll(async () => {
        runtime.client.close()
        await rm(directory, { force: true, recursive: true })
    })

    it('persists one secret and applies all migrations once', () => {
        expect(initializeLocalRuntime(directory).secret).toBe(runtime.secret)
        expect(runtime.secret).toHaveLength(64)
        expect(
            runtime.client
                .prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table'")
                .get(),
        ).toMatchObject({ count: expect.any(Number) })
        expect(runtime.client.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
    })

    it('shares one secret across concurrent Node processes', async () => {
        const secretDirectory = await mkdtemp(join(tmpdir(), 'avatio-local-secret-'))
        const moduleUrl = pathToFileURL(join(process.cwd(), 'config', 'localDevelopment.ts')).href
        const script = `
            import { getLocalAuthSecret } from ${JSON.stringify(moduleUrl)}
            process.stdout.write(getLocalAuthSecret(${JSON.stringify(secretDirectory)}))
        `
        try {
            const results = await Promise.all(
                Array.from({ length: 4 }, () =>
                    promisify(execFile)(process.execPath, [
                        '--input-type=module',
                        '--eval',
                        script,
                    ]),
                ),
            )
            expect(new Set(results.map(({ stdout }) => stdout))).toEqual(
                new Set([results[0]!.stdout]),
            )
        } finally {
            await rm(secretDirectory, { force: true, recursive: true })
        }
    })

    it('assigns admin only to the first successful user while users are empty', () => {
        expect(() =>
            runtime.client.exec(
                "INSERT INTO users (id, name, username, display_username, email) VALUES ('failed', NULL, 'failed', 'Failed', 'failed@example.com')",
            ),
        ).toThrow()
        runtime.client.exec(`
            INSERT INTO users (id, name, username, display_username, email, role)
            VALUES ('first', 'First', 'first', 'First', 'first@example.com', 'user');
            INSERT INTO users (id, name, username, display_username, email, role)
            VALUES ('second', 'Second', 'second', 'Second', 'second@example.com', 'user');
        `)
        expect(runtime.client.prepare('SELECT id, role FROM users ORDER BY id').all()).toEqual([
            { id: 'first', role: 'admin' },
            { id: 'second', role: 'user' },
        ])

        runtime.client.exec("DELETE FROM users WHERE id = 'first'")
        runtime.client.exec(
            "INSERT INTO users (id, name, username, display_username, email, role) VALUES ('third', 'Third', 'third', 'Third', 'third@example.com', 'user')",
        )
        expect(runtime.client.prepare("SELECT role FROM users WHERE id = 'third'").get()).toEqual({
            role: 'user',
        })

        runtime.client.exec('DELETE FROM users')
        runtime.client.exec(
            "INSERT INTO users (id, name, username, display_username, email, role) VALUES ('reset', 'Reset', 'reset', 'Reset', 'reset@example.com', 'user')",
        )
        expect(runtime.client.prepare("SELECT role FROM users WHERE id = 'reset'").get()).toEqual({
            role: 'admin',
        })
    })

    it('serializes concurrent first-user inserts at the database trigger', async () => {
        runtime.client.exec('DELETE FROM users')
        const databasePath = join(directory, '.data', 'avatio.sqlite')
        const insert = (id: string) =>
            new Promise<void>((resolve, reject) => {
                const worker = new Worker(
                    `
                        const { parentPort, workerData } = require('node:worker_threads')
                        const { DatabaseSync } = require('node:sqlite')
                        const database = new DatabaseSync(workerData.databasePath)
                        database.exec('PRAGMA busy_timeout = 5000')
                        database.prepare(
                            'INSERT INTO users (id, name, username, display_username, email, role) VALUES (?, ?, ?, ?, ?, ?)'
                        ).run(workerData.id, workerData.id, workerData.id, workerData.id, workerData.id + '@example.test', 'user')
                        database.close()
                        parentPort.postMessage('done')
                    `,
                    { eval: true, workerData: { databasePath, id } },
                )
                worker.once('message', () => resolve())
                worker.once('error', reject)
                worker.once('exit', (code) => {
                    if (code) reject(new Error(`Worker exited with ${code}.`))
                })
            })

        await Promise.all([insert('racer_a'), insert('racer_b')])
        expect(
            runtime.client
                .prepare("SELECT count(*) AS count FROM users WHERE role = 'admin'")
                .get(),
        ).toEqual({ count: 1 })
    })

    it('rolls back a failed multi-write', async () => {
        const db = runtime.database
        await expect(
            executeAppBatch(db, [
                db.insert(catalogItems).values({ id: 'rolled-back' }),
                db.insert(itemSources).values({
                    id: 'invalid-source',
                    itemId: 'missing-parent',
                    providerKey: 'github',
                    externalId: 'missing',
                    canonicalUrl: 'https://github.com/missing',
                    displayName: 'Missing',
                    nextCheckAt: new Date(),
                }),
            ]),
        ).rejects.toThrow()
        expect(
            await db
                .select({ id: catalogItems.id })
                .from(catalogItems)
                .where(eq(catalogItems.id, 'rolled-back')),
        ).toEqual([])
    })

    it('runs the shared Catalog and Publisher repositories on Node SQLite', async () => {
        const db = runtime.database
        const executeBatch = (queries: Parameters<typeof executeAppBatch>[1]) =>
            executeAppBatch(db, queries)
        const catalog = new SQLiteCatalogRepository(db, executeBatch)
        const source = await catalog.ensureSource({
            providerKey: 'github',
            externalId: 'local/repository',
            canonicalUrl: 'https://github.com/local/repository',
        })
        expect(await catalog.findSource(source.id)).toMatchObject({
            itemId: source.itemId,
            providerKey: 'github',
        })

        const publishers = new SQLitePublisherRepository(db, executeBatch)
        const publisherSource = await publishers.upsertSource({
            providerKey: 'booth',
            externalId: 'local-shop',
            canonicalUrl: 'https://local-shop.booth.pm',
            name: 'Local Shop',
            image: null,
            providerVerified: false,
            metadata: {},
        })
        expect(publisherSource).toMatchObject({ providerKey: 'booth', name: 'Local Shop' })
    })
})
