import type {
    CatalogItem,
    CatalogItemId,
    ExternalReference,
    CatalogRepository,
    ItemSource,
    ItemSourceSnapshot,
    ProviderSnapshot,
    ProviderAdmissionRule,
    ProviderAdmissionSignal,
    SourceLease,
} from '@avatio/core/catalog'
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { SQLiteAsyncDatabase } from 'drizzle-orm/sqlite-core'

import {
    catalogItems,
    itemSources,
    providerAdmissionOptions,
    providerAdmissionRules,
} from '../../../../database/schema'

type Database = SQLiteAsyncDatabase<'sync' | 'async', unknown>
type ExecuteBatch = (queries: BatchItem<'sqlite'>[]) => Promise<unknown[]>

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

export class SQLiteCatalogRepository implements CatalogRepository {
    readonly #db: Database
    readonly #executeBatch: ExecuteBatch

    constructor(database: Database, executeBatch: ExecuteBatch) {
        this.#db = database
        this.#executeBatch = executeBatch
    }

    async findProviderAdmissionRules(providerKey: string): Promise<ProviderAdmissionRule[]> {
        return this.#db
            .select({
                facetKey: providerAdmissionRules.facetKey,
                valueKey: providerAdmissionRules.valueKey,
                decision: providerAdmissionRules.decision,
            })
            .from(providerAdmissionRules)
            .where(eq(providerAdmissionRules.providerKey, providerKey))
    }

    async observeProviderAdmissionOptions(
        providerKey: string,
        signals: readonly ProviderAdmissionSignal[],
        observedAt: Date,
    ): Promise<void> {
        if (!signals.length) return
        await this.#db
            .insert(providerAdmissionOptions)
            .values(
                signals.map(({ facetKey, valueKey, label }) => ({
                    providerKey,
                    facetKey,
                    valueKey,
                    label,
                    firstSeenAt: observedAt,
                    lastSeenAt: observedAt,
                })),
            )
            .onConflictDoUpdate({
                target: [
                    providerAdmissionOptions.providerKey,
                    providerAdmissionOptions.facetKey,
                    providerAdmissionOptions.valueKey,
                ],
                set: { label: sql`excluded.label`, lastSeenAt: observedAt },
            })
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

    async ensureSource(reference: ExternalReference): Promise<ItemSource> {
        const existing = await this.findSourceByExternalId(
            reference.providerKey,
            reference.externalId,
        )
        if (existing) return existing
        const itemId = crypto.randomUUID()
        const sourceId = crypto.randomUUID()
        try {
            await this.#executeBatch([
                this.#db.insert(catalogItems).values({ id: itemId }),
                this.#db.insert(itemSources).values({
                    id: sourceId,
                    itemId,
                    ...reference,
                    primary: true,
                    displayName: reference.externalId,
                    nextCheckAt: new Date(),
                }),
            ])
        } catch (error) {
            // The unique source identity rolls the losing creation back with its CatalogItem.
            const concurrent = await this.findSourceByExternalId(
                reference.providerKey,
                reference.externalId,
            )
            if (concurrent) return concurrent
            throw error
        }
        const source = await this.findSource(sourceId)
        if (!source) throw new Error('Created catalog source is missing')
        return source
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
        const snapshot = input.snapshot
        const [updated] = await this.#db
            .update(itemSources)
            .set({
                availability: input.availability,
                syncState: input.successful ? 'fresh' : 'error',
                ...(snapshot
                    ? {
                          // Preserve existing aliases when another source owns the canonical key.
                          externalId: sql`CASE WHEN NOT EXISTS (
                              SELECT 1 FROM item_sources AS canonical
                              WHERE canonical.provider_key = ${itemSources.providerKey}
                                AND canonical.external_id = ${snapshot.reference.externalId}
                                AND canonical.id <> ${input.sourceId}
                          ) THEN ${snapshot.reference.externalId} ELSE ${itemSources.externalId} END`,
                          canonicalUrl: snapshot.reference.canonicalUrl,
                          publisherSourceId: snapshot.publisherSourceId,
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
                lastSuccessfulSyncAt: input.successful ? input.checkedAt : undefined,
                nextCheckAt: input.nextCheckAt,
                lastErrorKind: input.errorKind ?? null,
                lastErrorAt: input.errorKind ? input.checkedAt : null,
                syncLeaseUntil: null,
                syncLeaseToken: null,
            })
            .where(
                and(
                    eq(itemSources.id, input.sourceId),
                    eq(itemSources.syncLeaseToken, input.leaseToken),
                ),
            )
            .returning({ itemId: itemSources.itemId })
        return updated?.itemId ?? null
    }
}
