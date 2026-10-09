import type {
    CatalogClassification,
    CatalogClassificationChoice,
    CatalogClassificationLease,
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
import { and, eq, exists, isNull, lte, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { SQLiteAsyncDatabase } from 'drizzle-orm/sqlite-core'

import {
    catalogItemClassifications,
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
    updatedAt: row.updatedAt,
})

const mapClassification = (
    row: typeof catalogItemClassifications.$inferSelect,
): CatalogClassification => ({
    ...row,
    probabilities: row.probabilities ?? null,
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

    async findClassification(itemId: string): Promise<CatalogClassification | null> {
        const [classification] = await this.#db
            .select()
            .from(catalogItemClassifications)
            .where(eq(catalogItemClassifications.itemId, itemId))
            .limit(1)
        return classification ? mapClassification(classification) : null
    }

    async claimClassification(input: {
        itemId: string
        sourceId: string
        sourceUpdatedAt: Date
        inputHash: string
        classifierVersion: string
        requestedModel: string
        now: Date
        leaseUntil: Date
    }): Promise<CatalogClassificationLease | null> {
        const token = crypto.randomUUID()
        const [claimed] = await this.#db
            .insert(catalogItemClassifications)
            .values({
                itemId: input.itemId,
                sourceId: input.sourceId,
                sourceUpdatedAt: input.sourceUpdatedAt,
                inputHash: input.inputHash,
                classifierVersion: input.classifierVersion,
                requestedModel: input.requestedModel,
                status: 'processing',
                leaseToken: token,
                leaseUntil: input.leaseUntil,
            })
            .onConflictDoUpdate({
                target: catalogItemClassifications.itemId,
                set: {
                    sourceId: input.sourceId,
                    sourceUpdatedAt: input.sourceUpdatedAt,
                    inputHash: input.inputHash,
                    classifierVersion: input.classifierVersion,
                    requestedModel: input.requestedModel,
                    responseModel: null,
                    status: 'processing',
                    category: null,
                    confidence: null,
                    probabilities: null,
                    errorKind: null,
                    retryAt: null,
                    leaseToken: token,
                    leaseUntil: input.leaseUntil,
                },
                setWhere: sql`
                    ${catalogItemClassifications.sourceId} <> excluded.source_id
                    OR ${catalogItemClassifications.sourceUpdatedAt} <> excluded.source_updated_at
                    OR ${catalogItemClassifications.inputHash} <> excluded.input_hash
                    OR ${catalogItemClassifications.classifierVersion} <> excluded.classifier_version
                    OR ${catalogItemClassifications.requestedModel} <> excluded.requested_model
                    OR (
                        ${catalogItemClassifications.status} = 'processing'
                        AND (
                            ${catalogItemClassifications.leaseUntil} IS NULL
                            OR ${catalogItemClassifications.leaseUntil} <= ${input.now.getTime()}
                        )
                    )
                    OR (
                        ${catalogItemClassifications.status} = 'error'
                        AND (
                            ${catalogItemClassifications.retryAt} IS NULL
                            OR ${catalogItemClassifications.retryAt} <= ${input.now.getTime()}
                        )
                    )
                `,
            })
            .returning({ itemId: catalogItemClassifications.itemId })
        return claimed
            ? {
                  itemId: input.itemId,
                  sourceId: input.sourceId,
                  sourceUpdatedAt: input.sourceUpdatedAt,
                  inputHash: input.inputHash,
                  classifierVersion: input.classifierVersion,
                  requestedModel: input.requestedModel,
                  token,
                  expiresAt: input.leaseUntil,
              }
            : null
    }

    async completeClassification(input: {
        lease: CatalogClassificationLease
        responseModel: string
        category: CatalogClassificationChoice
        confidence: number
        probabilities: Record<string, number>
        accepted: boolean
        completedAt: Date
    }): Promise<void> {
        const queries: BatchItem<'sqlite'>[] = []
        const category = input.category === 'unknown' ? null : input.category
        const accepted = input.accepted && category !== null
        if (input.accepted && category) {
            queries.push(
                this.#db
                    .update(catalogItems)
                    .set({ categoryOverride: category, categoryOverrideOrigin: 'ai' })
                    .where(
                        and(
                            eq(catalogItems.id, input.lease.itemId),
                            or(
                                isNull(catalogItems.categoryOverrideOrigin),
                                eq(catalogItems.categoryOverrideOrigin, 'ai'),
                            ),
                            exists(
                                this.#db
                                    .select({ id: itemSources.id })
                                    .from(itemSources)
                                    .where(
                                        and(
                                            eq(itemSources.id, input.lease.sourceId),
                                            eq(itemSources.itemId, input.lease.itemId),
                                            eq(itemSources.updatedAt, input.lease.sourceUpdatedAt),
                                        ),
                                    ),
                            ),
                            exists(
                                this.#db
                                    .select({ itemId: catalogItemClassifications.itemId })
                                    .from(catalogItemClassifications)
                                    .where(
                                        and(
                                            eq(
                                                catalogItemClassifications.itemId,
                                                input.lease.itemId,
                                            ),
                                            eq(
                                                catalogItemClassifications.leaseToken,
                                                input.lease.token,
                                            ),
                                        ),
                                    ),
                            ),
                        ),
                    ),
            )
        }
        queries.push(
            this.#db
                .update(catalogItemClassifications)
                .set({
                    responseModel: input.responseModel,
                    status: accepted ? 'resolved' : 'uncertain',
                    category: input.category,
                    confidence: input.confidence,
                    probabilities: input.probabilities,
                    errorKind: null,
                    retryAt: null,
                    leaseToken: null,
                    leaseUntil: null,
                    updatedAt: input.completedAt,
                })
                .where(
                    and(
                        eq(catalogItemClassifications.itemId, input.lease.itemId),
                        eq(catalogItemClassifications.leaseToken, input.lease.token),
                    ),
                ),
        )
        await this.#executeBatch(queries)
    }

    async failClassification(input: {
        lease: CatalogClassificationLease
        errorKind: string
        retryAt: Date
        failedAt: Date
    }): Promise<void> {
        await this.#db
            .update(catalogItemClassifications)
            .set({
                status: 'error',
                errorKind: input.errorKind,
                retryAt: input.retryAt,
                leaseToken: null,
                leaseUntil: null,
                updatedAt: input.failedAt,
            })
            .where(
                and(
                    eq(catalogItemClassifications.itemId, input.lease.itemId),
                    eq(catalogItemClassifications.leaseToken, input.lease.token),
                ),
            )
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
