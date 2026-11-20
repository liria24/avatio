import { execFile } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { SQLiteCatalogRepository, SQLitePublisherRepository } from '@avatio/cloudflare'
import type { D1Database } from '@cloudflare/workers-types'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { getLocalAuthSecret } from '../../../config/localDevelopment'
import { relations } from '../../../database/relations'
import { catalogItems, itemSources, users } from '../../../database/schema'
import { prepareLocalD1 } from '../../../scripts/localDevelopment'
import { executeAppBatch } from '../../../server/utils/executeAppBatch'

describe('local D1 runtime', () => {
    let directory: string
    let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ APP_DB: D1Database }>>>
    let db: ReturnType<typeof drizzle<typeof relations>>

    const open = async () => {
        const paths = prepareLocalD1(directory)
        proxy = await getPlatformProxy<{ APP_DB: D1Database }>({
            configPath: paths.configPath,
            persist: { path: paths.proxyPersistencePath },
            remoteBindings: false,
        })
        db = drizzle(proxy.env.APP_DB, { relations })
    }

    beforeAll(async () => {
        directory = await mkdtemp(join(tmpdir(), 'avatio-local-d1-'))
        await cp(join(process.cwd(), 'drizzle'), join(directory, 'drizzle'), { recursive: true })
        await open()
    }, 120_000)

    afterAll(async () => {
        await proxy?.dispose()
        if (
            directory &&
            dirname(directory) === tmpdir() &&
            directory.startsWith(join(tmpdir(), 'avatio-local-d1-'))
        )
            await rm(directory, { force: true, recursive: true })
    })

    it('shares the CLI database, enforces foreign keys and persists across restarts', async () => {
        expect(
            await proxy.env.APP_DB.prepare('SELECT count(*) AS count FROM d1_migrations').first(),
        ).toEqual({ count: 18 })
        expect(await proxy.env.APP_DB.prepare('PRAGMA foreign_keys').first()).toEqual({
            foreign_keys: 1,
        })
        await db.insert(catalogItems).values({ id: 'persisted' })
        const secret = getLocalAuthSecret(directory)
        expect(secret).toHaveLength(64)
        await proxy.dispose()
        await open()
        expect(getLocalAuthSecret(directory)).toBe(secret)
        expect(await db.query.catalogItems.findFirst({ where: { id: 'persisted' } })).toMatchObject(
            { id: 'persisted' },
        )
        expect(
            await proxy.env.APP_DB.prepare('SELECT count(*) AS count FROM d1_migrations').first(),
        ).toEqual({ count: 18 })
    }, 120_000)

    it('shares one secret across concurrent Node processes', async () => {
        const moduleUrl = pathToFileURL(join(process.cwd(), 'config', 'localDevelopment.ts')).href
        const script = `import { getLocalAuthSecret } from ${JSON.stringify(moduleUrl)}; process.stdout.write(getLocalAuthSecret(${JSON.stringify(directory)}))`
        const results = await Promise.all(
            Array.from({ length: 4 }, () =>
                promisify(execFile)(process.execPath, ['--input-type=module', '--eval', script]),
            ),
        )
        expect(new Set(results.map(({ stdout }) => stdout))).toEqual(
            new Set([(await readFile(join(directory, '.data/local-auth-secret'), 'utf8')).trim()]),
        )
    })

    it('promotes exactly one first successful user, including concurrent signups', async () => {
        await expect(
            proxy.env.APP_DB.prepare(
                "INSERT INTO users (id, name, email) VALUES ('failed', NULL, 'failed@example.test')",
            ).run(),
        ).rejects.toThrow()
        const insert = (id: string) =>
            db.insert(users).values({
                id,
                name: id,
                username: id,
                displayUsername: id,
                email: `${id}@example.test`,
                role: 'user',
            })
        await Promise.all([insert('first'), insert('second')])
        const firstUsers = await db.select({ id: users.id, role: users.role }).from(users)
        expect(firstUsers.filter((user) => user.role === 'admin')).toHaveLength(1)
        await db
            .delete(users)
            .where(eq(users.id, firstUsers.find((user) => user.role === 'admin')!.id))
        await insert('third')
        expect(await db.query.users.findFirst({ where: { id: 'third' } })).toMatchObject({
            role: 'user',
        })
        await db.delete(users)
        await insert('reset')
        expect(await db.query.users.findFirst({ where: { id: 'reset' } })).toMatchObject({
            role: 'admin',
        })
    })

    it('rolls back a failed D1 batch', async () => {
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

    it('runs the shared Catalog and Publisher repositories on D1', async () => {
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
        expect(
            await publishers.upsertSource({
                providerKey: 'booth',
                externalId: 'local-shop',
                canonicalUrl: 'https://local-shop.booth.pm',
                name: 'Local Shop',
                image: null,
                providerVerified: false,
                metadata: {},
            }),
        ).toMatchObject({ providerKey: 'booth', name: 'Local Shop' })
    })
})
