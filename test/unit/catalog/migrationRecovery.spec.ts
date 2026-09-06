import { drizzle } from 'drizzle-orm/d1'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import {
    getCatalogMigrationRun,
    inspectCatalogV2Backfill,
    runCatalogMigrationChunk,
    startCatalogV2Backfill,
    verifyCatalogV2Backfill,
} from '../../../server/migration/catalog/migration'
import { createTestD1 } from '../../helpers/d1'

describe('persisted Catalog migration', () => {
    let database: ReturnType<typeof createTestD1>
    let db: ReturnType<typeof drizzle<typeof relations>>
    beforeEach(() => {
        database = createTestD1()
        db = drizzle(database.binding, { relations })
        database.sqlite.exec(`
            INSERT INTO users (id, name, username, display_username, email) VALUES ('user', 'User', 'user', 'User', 'user@example.com');
            INSERT INTO shops (id, platform, name) VALUES ('publisher', 'booth', 'Publisher');
            INSERT INTO user_shops (user_id, shop_id) VALUES ('user', 'publisher');
            INSERT INTO setups (id, user_id, name) VALUES ('abcdefgh', 'user', 'Setup');
        `)
        const insert = database.sqlite.prepare(
            "INSERT INTO items (id, platform, name, category, shop_id, outdated) VALUES (?, 'booth', 'Item', 'avatar', 'publisher', 1)",
        )
        for (let i = 0; i < 25; i++) insert.run(String(i).padStart(3, '0'))
        database.sqlite.exec(`
            INSERT INTO setup_items (id, item_id, setup_id, note) VALUES ('entry', '000', 'abcdefgh', 'Keep note');
            INSERT INTO setup_item_shapekeys (setup_item_id, name, value) VALUES ('entry', 'Shape', 0.5);
        `)
    })
    afterEach(() => {
        vi.restoreAllMocks()
        database.sqlite.close()
    })
    const finish = async () => {
        for (let i = 0; i < 30; i++) if (!(await runCatalogMigrationChunk(db)).more) return
        throw new Error('Migration did not reach verification')
    }

    it('processes bounded chunks, resumes a recorded failure, and requires explicit verification', async () => {
        expect((await inspectCatalogV2Backfill(db)).pending.catalogItems).toBe(25)
        await startCatalogV2Backfill(db)
        await runCatalogMigrationChunk(db)
        await runCatalogMigrationChunk(db)
        await runCatalogMigrationChunk(db)
        expect(await getCatalogMigrationRun(db)).toMatchObject({
            stage: 'catalog',
            cursor: '019',
            processed: 21,
        })
        expect(
            database.sqlite.prepare('SELECT count(*) AS count FROM catalog_items').get()?.count,
        ).toBe(20)
        vi.spyOn(database.binding, 'batch').mockRejectedValueOnce(new Error('simulated D1 failure'))
        await expect(runCatalogMigrationChunk(db)).rejects.toThrow('simulated')
        expect(await getCatalogMigrationRun(db)).toMatchObject({
            status: 'failed',
            cursor: '019',
            lastError: expect.stringContaining('catalog/019'),
        })
        await startCatalogV2Backfill(db)
        await finish()
        expect(await getCatalogMigrationRun(db)).toMatchObject({
            status: 'awaiting-verification',
            verifiedAt: null,
        })
        expect((await verifyCatalogV2Backfill(db)).verified).toBe(true)
        expect(await getCatalogMigrationRun(db)).toMatchObject({
            status: 'complete',
            verification: { verified: true },
        })
        expect(
            database.sqlite.prepare('SELECT count(*) AS count FROM catalog_items').get()?.count,
        ).toBe(25)
        expect(
            database.sqlite
                .prepare('SELECT availability, sync_state FROM item_sources LIMIT 1')
                .get(),
        ).toMatchObject({ availability: 'unknown', sync_state: 'stale' })
    })

    it('reruns an applied chunk without duplicates and detects inconsistent completed mappings', async () => {
        await startCatalogV2Backfill(db)
        await finish()
        database.sqlite.exec(
            "UPDATE catalog_migration_runs SET stage = 'publishers', cursor = NULL, status = 'running'",
        )
        await finish()
        expect((await verifyCatalogV2Backfill(db)).verified).toBe(true)
        expect(
            database.sqlite.prepare('SELECT count(*) AS count FROM publishers').get()?.count,
        ).toBe(1)
        database.sqlite.exec("UPDATE setup_entries SET note = 'Wrong' WHERE id = 'entry'")
        const report = await verifyCatalogV2Backfill(db)
        expect(report.verified).toBe(false)
        expect(report.issues).toContainEqual(
            expect.objectContaining({ kind: 'setup-entry', severity: 'error' }),
        )
        database.sqlite.exec('DELETE FROM setup_entry_shapekeys')
        expect((await inspectCatalogV2Backfill(db)).pending.shapekeys).toBe(1)
    })

    it('blocks live concurrent runners and fences a lease reclaimed immediately before commit', async () => {
        await startCatalogV2Backfill(db)
        const batch = database.binding.batch.bind(database.binding)
        vi.spyOn(database.binding, 'batch').mockImplementationOnce((statements) => {
            database.sqlite.exec(
                "UPDATE catalog_migration_runs SET lease_token = 'successor', lease_until = 9999999999999",
            )
            return batch(statements)
        })
        await expect(runCatalogMigrationChunk(db)).rejects.toThrow()
        expect(await getCatalogMigrationRun(db)).toMatchObject({
            status: 'running',
            cursor: null,
            leaseToken: 'successor',
        })
        expect(
            database.sqlite.prepare('SELECT count(*) AS count FROM publishers').get()?.count,
        ).toBe(0)
        await runCatalogMigrationChunk(db)
        expect(await getCatalogMigrationRun(db)).toMatchObject({ leaseToken: 'successor' })
        database.sqlite.exec('UPDATE catalog_migration_runs SET lease_until = 0')
        await finish()
        expect((await verifyCatalogV2Backfill(db)).verified).toBe(true)
    })
})
