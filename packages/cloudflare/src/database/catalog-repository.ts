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
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { drizzle } from 'drizzle-orm/d1'

import {
    catalogItems,
    items as legacyItems,
    itemSources,
    publisherSources,
    publishers,
    shops as legacyShops,
} from '../../../../database/schema'

type Database = ReturnType<typeof drizzle>
type Statement = BatchItem<'sqlite'>

const runBatch = async (db: Database, statements: Statement[]) => {
    const first = statements[0]
    if (!first) return
    await db.batch([first, ...statements.slice(1)])
}

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

    async claimDueSource(id: string, now: Date, leaseUntil: Date): Promise<SourceLease | null> {
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
                    lte(itemSources.nextCheckAt, now),
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

    async markSyncStarted(id: string, now: Date): Promise<ItemSource | null> {
        const [source] = await this.#db
            .update(itemSources)
            .set({ syncState: 'syncing', lastCheckedAt: now })
            .where(eq(itemSources.id, id))
            .returning()
        return source ? mapSource(source) : null
    }

    async completeSourceSync(input: {
        sourceId: string
        availability?: ItemSource['availability']
        snapshot?: ProviderSnapshot
        checkedAt: Date
        nextCheckAt: Date
        successful: boolean
        errorKind?: string
    }): Promise<CatalogItemId> {
        const source = await this.findSource(input.sourceId)
        if (!source) throw new Error(`Catalog source not found: ${input.sourceId}`)
        const [catalogItem] = await this.#db
            .select()
            .from(catalogItems)
            .where(eq(catalogItems.id, source.itemId))
            .limit(1)
        if (!catalogItem) throw new Error(`Catalog item not found: ${source.itemId}`)

        const statements: Statement[] = []
        let publisherSourceId = source.publisherSourceId
        const publisher = input.snapshot?.publisher
        if (publisher) {
            const [existingPublisherSource] = await this.#db
                .select()
                .from(publisherSources)
                .where(
                    and(
                        eq(publisherSources.providerKey, source.providerKey),
                        eq(publisherSources.externalId, publisher.externalId),
                    ),
                )
                .limit(1)

            if (existingPublisherSource) {
                publisherSourceId = existingPublisherSource.id
                statements.push(
                    this.#db
                        .update(publisherSources)
                        .set({
                            canonicalUrl: publisher.canonicalUrl,
                            name: publisher.name,
                            image: publisher.image,
                            providerVerified: publisher.providerVerified,
                            metadata: publisher.metadata,
                        })
                        .where(eq(publisherSources.id, existingPublisherSource.id)),
                )
            } else {
                const publisherId = crypto.randomUUID()
                publisherSourceId = crypto.randomUUID()
                statements.push(
                    this.#db.insert(publishers).values({ id: publisherId }),
                    this.#db.insert(publisherSources).values({
                        id: publisherSourceId,
                        publisherId,
                        providerKey: source.providerKey,
                        externalId: publisher.externalId,
                        canonicalUrl: publisher.canonicalUrl,
                        name: publisher.name,
                        image: publisher.image,
                        providerVerified: publisher.providerVerified,
                        metadata: publisher.metadata,
                    }),
                )
            }
        }

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
                    syncLeaseUntil: null,
                    syncLeaseToken: null,
                    lastErrorKind: input.errorKind ?? null,
                    lastErrorAt: input.errorKind ? input.checkedAt : null,
                })
                .where(eq(itemSources.id, input.sourceId)),
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
                        .where(eq(legacyItems.id, source.externalId)),
                )
            if (snapshot.publisher)
                statements.push(
                    this.#db
                        .insert(legacyShops)
                        .values({
                            id: snapshot.publisher.externalId,
                            platform: legacyProvider,
                            name: snapshot.publisher.name,
                            image: snapshot.publisher.image,
                            verified: snapshot.publisher.providerVerified,
                        })
                        .onConflictDoUpdate({
                            target: legacyShops.id,
                            set: {
                                platform: legacyProvider,
                                name: snapshot.publisher.name,
                                image: snapshot.publisher.image,
                                verified: snapshot.publisher.providerVerified,
                            },
                        }),
                )
            statements.push(
                this.#db
                    .insert(legacyItems)
                    .values({
                        id: snapshot.reference.externalId,
                        platform: legacyProvider,
                        outdated: false,
                        shopId: snapshot.publisher?.externalId ?? null,
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
                    })
                    .onConflictDoUpdate({
                        target: legacyItems.id,
                        set: {
                            platform: legacyProvider,
                            outdated: false,
                            shopId: snapshot.publisher?.externalId ?? null,
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
                    .where(eq(legacyItems.id, source.externalId)),
            )
        }

        await runBatch(this.#db, statements)
        return source.itemId
    }
}
