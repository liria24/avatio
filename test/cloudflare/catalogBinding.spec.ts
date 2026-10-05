import { SQLiteCatalogRepository } from '@avatio/cloudflare'
import type { D1Database, KVNamespace } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { createStorage } from 'unstorage'
import kvDriver from 'unstorage/drivers/cloudflare-kv-binding'

import { relations } from '../../database/relations'

let miniflare: Miniflare
let repository: SQLiteCatalogRepository
beforeAll(async () => {
    miniflare = new Miniflare(
        convertV4MiniflareOptions({
            modules: true,
            script: 'export default { fetch() { return new Response("isolated fixture") } }',
            compatibilityDate: '2026-05-26',
            d1Databases: ['APP_DB'],
            kvNamespaces: ['CONTENT_CACHE'],
            d1Persist: false,
            kvPersist: false,
            outboundService: () => {
                throw new Error('Fixture outbound network is forbidden')
            },
        }),
    )
    const binding = (await miniflare.getD1Database('APP_DB')) as unknown as D1Database
    const db = drizzle(binding, { relations })
    // Fresh synthetic database only. This does not establish deployment ledger compatibility.
    await migrate(db, { migrationsFolder: 'drizzle' })
    repository = new SQLiteCatalogRepository(db, async (queries) =>
        queries.length ? await db.batch([queries[0]!, ...queries.slice(1)]) : [],
    )
})
afterAll(async () => {
    await miniflare?.dispose()
})

it('runs the owned Catalog repository against real local D1 bindings', async () => {
    const reference = {
        providerKey: 'github',
        externalId: 'fixture/catalog',
        canonicalUrl: 'https://github.com/fixture/catalog',
    }
    const created = await repository.ensureSource(reference)
    expect(created).toMatchObject({
        providerKey: 'github',
        externalId: reference.externalId,
        primary: true,
        availability: 'unknown',
        syncState: 'stale',
    })
    expect(created.nextCheckAt).toBeInstanceOf(Date)
    expect((await repository.ensureSource(reference)).itemId).toBe(created.itemId)
    expect((await repository.findItem(created.itemId))?.id).toBe(created.itemId)
    await repository.observeProviderAdmissionOptions(
        'fixture',
        [{ facetKey: 'tag', valueKey: 'avatar', label: 'Avatar' }],
        new Date('2026-01-01'),
    )
    await repository.observeProviderAdmissionOptions(
        'fixture',
        [{ facetKey: 'tag', valueKey: 'avatar', label: 'Updated Avatar' }],
        new Date('2026-01-02'),
    )
    const binding = await miniflare.getD1Database('APP_DB')
    expect(
        await binding
            .prepare(
                'SELECT label, first_seen_at, last_seen_at FROM provider_admission_options WHERE provider_key = ?',
            )
            .bind('fixture')
            .all(),
    ).toMatchObject({
        results: [
            {
                label: 'Updated Avatar',
                first_seen_at: Date.parse('2026-01-01'),
                last_seen_at: Date.parse('2026-01-02'),
            },
        ],
    })
})

it('keeps authored-content cache writes inside the prefix without changing retained KV keys', async () => {
    const binding = await miniflare.getKVNamespace('CONTENT_CACHE')
    await binding.put('retained-key', 'retained-content')
    const storage = createStorage({
        driver: kvDriver({
            binding: binding as unknown as KVNamespace,
            base: 'authored-content:v1:fixture:development',
        }),
    })
    try {
        await storage.setItem('manifest', { revision: 'fixture-commit' })
        expect(await storage.getItem('manifest')).toEqual({ revision: 'fixture-commit' })
        expect(await binding.get('retained-key')).toBe('retained-content')
        expect((await binding.list()).keys.map((key) => key.name)).toEqual(
            expect.arrayContaining([
                'retained-key',
                'authored-content:v1:fixture:development:manifest',
            ]),
        )
        await storage.removeItem('manifest')
        expect(await binding.get('retained-key')).toBe('retained-content')
    } finally {
        await storage.dispose()
    }
})
