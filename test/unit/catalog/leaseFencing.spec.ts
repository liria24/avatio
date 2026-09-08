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
        `)
    })
    afterEach(() => {
        database.sqlite.close()
        vi.unstubAllGlobals()
    })

    it('refreshes an existing alias without replacing its identity or colliding with a canonical source', async () => {
        database.sqlite.exec(`
            INSERT INTO catalog_items (id) VALUES ('alias-item');
            INSERT INTO item_sources (id, item_id, provider_key, external_id, canonical_url, next_check_at, display_name)
            VALUES ('alias', 'alias-item', 'booth', '123.0', 'https://booth.pm/items/123.0', 0, 'Alias');
        `)
        const lease = await repository.claimDueSource('alias', new Date(0), new Date(1000))
        await repository.completeSourceSync({
            sourceId: 'alias',
            leaseToken: lease!.token,
            successful: true,
            snapshot,
            availability: 'available',
            checkedAt: new Date(1),
            nextCheckAt: new Date(3000),
        })
        expect(await repository.findSource('alias')).toMatchObject({
            externalId: '123.0',
            canonicalUrl: snapshot.reference.canonicalUrl,
            syncLeaseToken: null,
            syncState: 'fresh',
            snapshot: { name: 'New snapshot' },
        })
    })

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

    it('adopts an unclaimed canonical identity without changing the CatalogItem ID', async () => {
        const renamed = {
            ...snapshot,
            reference: {
                ...snapshot.reference,
                externalId: '456',
                canonicalUrl: 'https://booth.pm/items/456',
            },
        }
        const lease = await repository.claimDueSource('source', new Date(0), new Date(1000))
        await repository.completeSourceSync({
            sourceId: 'source',
            leaseToken: lease!.token,
            successful: true,
            snapshot: renamed,
            availability: 'available',
            checkedAt: new Date(1),
            nextCheckAt: new Date(3000),
        })
        expect(await repository.findSourceByExternalId('booth', '456')).toMatchObject({
            id: 'source',
            itemId: 'item',
            canonicalUrl: renamed.reference.canonicalUrl,
        })
        await repository.completeSourceSync({
            sourceId: 'source',
            leaseToken: lease!.token,
            successful: true,
            snapshot,
            availability: 'available',
            checkedAt: new Date(2),
            nextCheckAt: new Date(3000),
        })
        expect(await repository.findSource('source')).toMatchObject({
            externalId: '456',
            canonicalUrl: renamed.reference.canonicalUrl,
        })
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
        'fences completion (successful=%s), after another worker reclaims the lease',
        async (successful) => {
            const lease = await repository.claimDueSource('source', new Date(0), new Date(1000))
            database.sqlite.exec(
                "UPDATE item_sources SET sync_lease_token = 'new-owner', sync_lease_until = 2000",
            )
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
        },
    )

    it('commits a current snapshot atomically and releases only that lease', async () => {
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
