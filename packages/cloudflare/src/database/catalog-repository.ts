import type {
    CatalogItem,
    CatalogItemId,
    CatalogRepository,
    ItemSource,
    ItemSourceSnapshot,
    ProviderSnapshot,
    SourceLease,
} from '@avatio/core/catalog'
import type { D1Database } from '@cloudflare/workers-types'
import { and, eq, exists, isNull, lte, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { drizzle } from 'drizzle-orm/d1'

import {
    catalogItems,
    items as legacyItems,
    itemSources,
    publisherSources,
    shops as legacyShops,
} from '../../../../database/schema'

type Database = ReturnType<typeof drizzle>
type Statement = BatchItem<'sqlite'>

const mapSnapshot = (row: typeof itemSources.$inferSelect): ItemSourceSnapshot => ({
    name: row.displayName,
    image: row.image,
    price: row.price,
    popularityCount: row.popularityCount,
    nsfw: row.nsfw,
    category: row.providerCategoryKey
        ? {
              rawKey: row.providerCategoryKey,
              rawLabel: row.providerCategoryLabel ?? undefined,
              mappedCategory: row.mappedCategory,
          }
        : null,
    metadata: row.metadata ?? {},
})

const mapSource = (row: typeof itemSources.$inferSelect): ItemSource => ({
    id: row.id,
    itemId: row.itemId,
    providerKey: row.providerKey,
    externalId: row.externalId,
    canonicalUrl: row.canonicalUrl,
    publisherSourceId: row.publisherSourceId,
    primary: row.primary,
    availability: row.availability,
    syncState: row.syncState,
    snapshot: mapSnapshot(row),
    lastCheckedAt: row.lastCheckedAt,
    lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
    nextCheckAt: row.nextCheckAt,
    syncLeaseUntil: row.syncLeaseUntil,
    syncLeaseToken: row.syncLeaseToken,
    lastErrorKind: row.lastErrorKind,
    lastErrorAt: row.lastErrorAt,
})

export class D1CatalogRepository implements CatalogRepository {
    readonly #db: Database

    constructor(database: D1Database) {
        this.#db = drizzle(database)
    }

    async findItem(id: string): Promise<CatalogItem | null> {
        const [item] = await this.#db
            .select()
            .from(catalogItems)
            .where(eq(catalogItems.id, id))
            .limit(1)
        if (!item) return null

        const [primarySource] = await this.#db
            .select({ id: itemSources.id })
            .from(itemSources)
            .where(and(eq(itemSources.itemId, id), eq(itemSources.primary, true)))
            .limit(1)
        return {
            id: item.id,
            primarySourceId: primarySource?.id ?? null,
            displayNameOverride: item.displayNameOverride,
            categoryOverride: item.categoryOverride,
            categoryOverrideOrigin: item.categoryOverrideOrigin,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        }
    }

    async findSource(id: string): Promise<ItemSource | null> {
        const [source] = await this.#db
            .select()
            .from(itemSources)
            .where(eq(itemSources.id, id))
            .limit(1)
        return source ? mapSource(source) : null
    }

    async findSourceByExternalId(
        providerKey: string,
        externalId: string,
    ): Promise<ItemSource | null> {
        const [source] = await this.#db
            .select()
            .from(itemSources)
            .where(
                and(
                    eq(itemSources.providerKey, providerKey),
                    eq(itemSources.externalId, externalId),
                ),
            )
            .limit(1)
        return source ? mapSource(source) : null
    }

    async scheduleSourceCheck(id: string, now: Date): Promise<boolean> {
        const [scheduled] = await this.#db
            .update(itemSources)
            .set({ nextCheckAt: now })
            .where(eq(itemSources.id, id))
            .returning({ id: itemSources.id })
        return Boolean(scheduled)
    }

    async claimDueSource(
        id: string,
        now: Date,
        leaseUntil: Date,
        force = false,
    ): Promise<SourceLease | null> {
        const token = crypto.randomUUID()
        const [claimed] = await this.#db
            .update(itemSources)
            .set({
                syncState: 'syncing',
                syncLeaseUntil: leaseUntil,
                syncLeaseToken: token,
            })
            .where(
                and(
                    eq(itemSources.id, id),
                    force ? undefined : lte(itemSources.nextCheckAt, now),
                    or(isNull(itemSources.syncLeaseUntil), lte(itemSources.syncLeaseUntil, now)),
                ),
            )
            .returning({ id: itemSources.id })
        return claimed ? { sourceId: claimed.id, token, expiresAt: leaseUntil } : null
    }

    async releaseSourceLease(lease: SourceLease): Promise<void> {
        await this.#db
            .update(itemSources)
            .set({ syncState: 'stale', syncLeaseUntil: null, syncLeaseToken: null })
            .where(
                and(
                    eq(itemSources.id, lease.sourceId),
                    eq(itemSources.syncLeaseToken, lease.token),
                ),
            )
    }

    async markSyncStarted(id: string, leaseToken: string, now: Date): Promise<ItemSource | null> {
        const [source] = await this.#db
            .update(itemSources)
            .set({ syncState: 'syncing', lastCheckedAt: now })
            .where(and(eq(itemSources.id, id), eq(itemSources.syncLeaseToken, leaseToken)))
            .returning()
        return source ? mapSource(source) : null
    }

    async completeSourceSync(input: {
        sourceId: string
        leaseToken: string
        availability?: ItemSource['availability']
        snapshot?: ProviderSnapshot
        checkedAt: Date
        nextCheckAt: Date
        successful: boolean
        errorKind?: string
    }): Promise<CatalogItemId | null> {
        const source = await this.findSource(input.sourceId)
        if (!source || source.syncLeaseToken !== input.leaseToken) return null
        const ownsLease = and(
            eq(itemSources.id, input.sourceId),
            eq(itemSources.syncLeaseToken, input.leaseToken),
        )
        const leaseExists = exists(
            this.#db.select({ id: itemSources.id }).from(itemSources).where(ownsLease),
        )
        const [catalogItem] = await this.#db
            .select()
            .from(catalogItems)
            .where(eq(catalogItems.id, source.itemId))
            .limit(1)
        if (!catalogItem) throw new Error(`Catalog item not found: ${source.itemId}`)

        const statements: Statement[] = []
        const publisherSourceId = input.snapshot?.publisherSourceId ?? source.publisherSourceId
        const [publisher] = publisherSourceId
            ? await this.#db
                  .select()
                  .from(publisherSources)
                  .where(eq(publisherSources.id, publisherSourceId))
                  .limit(1)
            : []

        const snapshot = input.snapshot
        statements.push(
            this.#db
                .update(itemSources)
                .set({
                    availability: input.availability ?? source.availability,
                    syncState: input.successful ? 'fresh' : 'error',
                    ...(snapshot
                        ? {
                              providerKey: snapshot.reference.providerKey,
                              externalId: snapshot.reference.externalId,
                              canonicalUrl: snapshot.reference.canonicalUrl,
                              publisherSourceId,
                              providerCategoryKey: snapshot.category?.rawKey ?? null,
                              providerCategoryLabel: snapshot.category?.rawLabel ?? null,
                              mappedCategory: snapshot.category?.mappedCategory ?? null,
                              displayName: snapshot.name,
                              image: snapshot.image,
                              price: snapshot.price,
                              popularityCount: snapshot.popularityCount,
                              nsfw: snapshot.nsfw,
                              metadata: snapshot.metadata,
                          }
                        : {}),
                    lastCheckedAt: input.checkedAt,
                    lastSuccessfulSyncAt: input.successful
                        ? input.checkedAt
                        : source.lastSuccessfulSyncAt,
                    nextCheckAt: input.nextCheckAt,
                    lastErrorKind: input.errorKind ?? null,
                    lastErrorAt: input.errorKind ? input.checkedAt : null,
                })
                .where(ownsLease),
        )

        const legacyProvider =
            source.providerKey === 'booth' || source.providerKey === 'github'
                ? source.providerKey
                : null
        if (legacyProvider && snapshot) {
            if (source.externalId !== snapshot.reference.externalId)
                statements.push(
                    this.#db
                        .update(legacyItems)
                        .set({ id: snapshot.reference.externalId })
                        .where(and(eq(legacyItems.id, source.externalId), leaseExists)),
                )
            if (publisher)
                statements.push(
                    this.#db
                        .insert(legacyShops)
                        .select(
                            this.#db
                                .select({
                                    id: sql<string>`${publisher.externalId}`.as('id'),
                                    platform: sql<typeof legacyProvider>`${legacyProvider}`.as(
                                        'platform',
                                    ),
                                    name: sql<string>`${publisher.name}`.as('name'),
                                    image: sql<string | null>`${publisher.image}`.as('image'),
                                    verified:
                                        sql<boolean>`${Number(publisher.providerVerified)}`.as(
                                            'verified',
                                        ),
                                })
                                .from(itemSources)
                                .where(ownsLease),
                        )
                        .onConflictDoUpdate({
                            target: legacyShops.id,
                            set: {
                                platform: legacyProvider,
                                name: publisher.name,
                                image: publisher.image,
                                verified: publisher.providerVerified,
                            },
                        }),
                )
            statements.push(
                this.#db
                    .insert(legacyItems)
                    .select(
                        this.#db
                            .select({
                                id: sql<string>`${snapshot.reference.externalId}`.as('id'),
                                platform: sql<typeof legacyProvider>`${legacyProvider}`.as(
                                    'platform',
                                ),
                                outdated: sql<boolean>`0`.as('outdated'),
                                shopId: sql<string | null>`${publisher?.externalId ?? null}`.as(
                                    'shop_id',
                                ),
                                name: sql<string>`${snapshot.name}`.as('name'),
                                niceName: sql<string | null>`${catalogItem.displayNameOverride}`.as(
                                    'nice_name',
                                ),
                                category: sql<
                                    typeof legacyItems.$inferSelect.category
                                >`${catalogItem.categoryOverride ?? snapshot.category?.mappedCategory ?? 'other'}`.as(
                                    'category',
                                ),
                                image: sql<string | null>`${snapshot.image}`.as('image'),
                                price: sql<string | null>`${snapshot.price}`.as('price'),
                                likes: sql<number | null>`${snapshot.popularityCount}`.as('likes'),
                                nsfw: sql<boolean>`${Number(snapshot.nsfw)}`.as('nsfw'),
                            })
                            .from(itemSources)
                            .where(ownsLease),
                    )
                    .onConflictDoUpdate({
                        target: legacyItems.id,
                        set: {
                            platform: legacyProvider,
                            outdated: false,
                            shopId: publisher?.externalId ?? null,
                            name: snapshot.name,
                            niceName: catalogItem.displayNameOverride,
                            category:
                                catalogItem.categoryOverride ??
                                snapshot.category?.mappedCategory ??
                                'other',
                            image: snapshot.image,
                            price: snapshot.price,
                            likes: snapshot.popularityCount,
                            nsfw: snapshot.nsfw,
                        },
                    }),
            )
        } else if (
            legacyProvider &&
            (input.availability === 'withdrawn' || input.availability === 'policy_rejected')
        ) {
            statements.push(
                this.#db
                    .update(legacyItems)
                    .set({ outdated: true })
                    .where(and(eq(legacyItems.id, source.externalId), leaseExists)),
            )
        }

        // Keep the token until every guarded mirror write has run in the same atomic batch.
        const release = this.#db
            .update(itemSources)
            .set({ syncLeaseUntil: null, syncLeaseToken: null })
            .where(ownsLease)
            .returning({ itemId: itemSources.itemId })
        const first = statements[0]
        if (!first) return null
        const results = await this.#db.batch([first, ...statements.slice(1), release])
        const released = results.at(-1) as { itemId: string }[]
        return released[0]?.itemId ?? null
    }
}
