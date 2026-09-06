import { D1CatalogRepository } from '@avatio/cloudflare'
import type { ProviderSnapshot } from '@avatio/core/catalog'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestD1 } from '../../helpers/d1'

describe('Catalog D1 lease fencing', () => {
    let database: ReturnType<typeof createTestD1>
    let repository: D1CatalogRepository
    const snapshot: ProviderSnapshot = {
        reference: {
            providerKey: 'booth',
            externalId: '123',
            canonicalUrl: 'https://booth.pm/ja/items/123',
        },
        name: 'New snapshot',
        image: null,
        price: null,
        popularityCount: 1,
        nsfw: false,
        category: null,
        metadata: {},
        publisherSourceId: null,
    }
    beforeEach(() => {
        database = createTestD1()
        repository = new D1CatalogRepository(database.binding)
        database.sqlite.exec(`
            INSERT INTO catalog_items (id) VALUES ('item');
            INSERT INTO item_sources (id, item_id, provider_key, external_id, canonical_url, next_check_at, display_name)
            VALUES ('source', 'item', 'booth', '123', 'https://booth.pm/ja/items/123', 0, 'Original');
            INSERT INTO items (id, platform, name, category) VALUES ('123', 'booth', 'Original', 'other');
        `)
    })
    afterEach(() => database.sqlite.close())

    it('claims once while valid and reclaims expired leases with a new token', async () => {
        const first = await repository.claimDueSource('source', new Date(0), new Date(1000))
        expect(first).not.toBeNull()
        expect(await repository.claimDueSource('source', new Date(999), new Date(2000))).toBeNull()
        expect(
            await repository.claimDueSource('source', new Date(999), new Date(2000), true),
        ).toBeNull()
        const second = await repository.claimDueSource('source', new Date(1000), new Date(2000))
        expect(second?.token).not.toBe(first?.token)
        expect(await repository.markSyncStarted('source', first!.token, new Date(1001))).toBeNull()
        await repository.releaseSourceLease(first!)
        expect((await repository.findSource('source'))?.syncLeaseToken).toBe(second?.token)
    })

    it('claims a forced refresh atomically without rewriting its schedule first', async () => {
        database.sqlite.exec('UPDATE item_sources SET next_check_at = 2000')
        expect(await repository.claimDueSource('source', new Date(0), new Date(1000))).toBeNull()
        expect(
            await repository.claimDueSource('source', new Date(0), new Date(1000), true),
        ).not.toBeNull()
        expect((await repository.findSource('source'))?.nextCheckAt.getTime()).toBe(2000)
    })

    it.each([true, false])(
        'fences completion (successful=%s), including a reclaim immediately before the atomic batch',
        async (successful) => {
            const lease = await repository.claimDueSource('source', new Date(0), new Date(1000))
            const batch = database.binding.batch.bind(database.binding)
            vi.spyOn(database.binding, 'batch').mockImplementationOnce((statements) => {
                database.sqlite.exec(
                    "UPDATE item_sources SET sync_lease_token = 'new-owner', sync_lease_until = 2000",
                )
                return batch(statements)
            })
            expect(
                await repository.completeSourceSync({
                    sourceId: 'source',
                    leaseToken: lease!.token,
                    successful,
                    snapshot: successful ? snapshot : undefined,
                    availability: successful ? 'available' : undefined,
                    errorKind: successful ? undefined : 'timeout',
                    checkedAt: new Date(1001),
                    nextCheckAt: new Date(3000),
                }),
            ).toBeNull()
            expect(await repository.findSource('source')).toMatchObject({
                syncLeaseToken: 'new-owner',
                snapshot: { name: 'Original' },
                lastErrorKind: null,
            })
            expect(
                database.sqlite.prepare("SELECT name FROM items WHERE id = '123'").get()?.name,
            ).toBe('Original')
        },
    )

    it('commits a current snapshot and mirror together and releases only that lease', async () => {
        const lease = await repository.claimDueSource('source', new Date(0), new Date(1000))
        expect(
            await repository.completeSourceSync({
                sourceId: 'source',
                leaseToken: lease!.token,
                successful: true,
                snapshot,
                availability: 'available',
                checkedAt: new Date(1),
                nextCheckAt: new Date(3000),
            }),
        ).toBe('item')
        expect(await repository.findSource('source')).toMatchObject({
            syncLeaseToken: null,
            syncState: 'fresh',
            snapshot: { name: 'New snapshot' },
        })
        expect(database.sqlite.prepare("SELECT name FROM items WHERE id = '123'").get()?.name).toBe(
            'New snapshot',
        )
        expect(
            await repository.completeSourceSync({
                sourceId: 'source',
                leaseToken: lease!.token,
                successful: false,
                checkedAt: new Date(2),
                nextCheckAt: new Date(4000),
                errorKind: 'late-failure',
            }),
        ).toBeNull()
    })
})
