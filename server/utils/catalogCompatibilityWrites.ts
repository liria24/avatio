import { catalogItems, itemSources, publisherSources, publishers } from '@@/database/schema'
import { and, eq, inArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

import { legacyItemCanonicalUrl, legacyPublisherCanonicalUrl } from './catalogLegacyMigration'
import type { AppDatabase } from './database'

const SOURCE_FRESHNESS_MS = 24 * 60 * 60 * 1000

export interface CatalogCompatibilityWriteInput {
    providerKey: Platform
    externalId: string
    previousExternalId?: string
    name: string
    image: string | null
    price: string | null
    popularityCount: number | null
    nsfw: boolean
    displayNameOverride?: string | null
    categoryOverride?: ItemCategory
    categoryOverrideOrigin?: 'manual' | 'ai' | 'rule' | 'legacy'
    providerCategory?: {
        rawKey: string
        rawLabel?: string
        mappedCategory: ItemCategory | null
    } | null
    metadata?: Record<string, unknown>
    publisher: {
        externalId: string
        name: string
        image: string | null
        providerVerified: boolean
    }
    checkedAt?: Date
}

export const buildCatalogCompatibilityStatements = async (
    db: AppDatabase,
    input: CatalogCompatibilityWriteInput,
): Promise<{ catalogItemId: string; sourceId: string; statements: BatchItem<'sqlite'>[] }> => {
    const checkedAt = input.checkedAt ?? new Date()
    const externalIds = [input.externalId, input.previousExternalId].filter(
        (value): value is string => Boolean(value),
    )
    const [existingSource] = await db
        .select()
        .from(itemSources)
        .where(
            and(
                eq(itemSources.providerKey, input.providerKey),
                inArray(itemSources.externalId, externalIds),
            ),
        )
        .limit(1)
    const [existingPublisherSource] = await db
        .select()
        .from(publisherSources)
        .where(
            and(
                eq(publisherSources.providerKey, input.providerKey),
                eq(publisherSources.externalId, input.publisher.externalId),
            ),
        )
        .limit(1)

    const statements: BatchItem<'sqlite'>[] = []
    let publisherSourceId = existingPublisherSource?.id
    if (existingPublisherSource) {
        statements.push(
            db
                .update(publisherSources)
                .set({
                    canonicalUrl: legacyPublisherCanonicalUrl(
                        input.providerKey,
                        input.publisher.externalId,
                    ),
                    name: input.publisher.name,
                    image: input.publisher.image,
                    providerVerified: input.publisher.providerVerified,
                })
                .where(eq(publisherSources.id, existingPublisherSource.id)),
        )
    } else {
        const publisherId = crypto.randomUUID()
        publisherSourceId = crypto.randomUUID()
        statements.push(
            db.insert(publishers).values({ id: publisherId }),
            db.insert(publisherSources).values({
                id: publisherSourceId,
                publisherId,
                providerKey: input.providerKey,
                externalId: input.publisher.externalId,
                canonicalUrl: legacyPublisherCanonicalUrl(
                    input.providerKey,
                    input.publisher.externalId,
                ),
                name: input.publisher.name,
                image: input.publisher.image,
                providerVerified: input.publisher.providerVerified,
            }),
        )
    }

    const sourceValues = {
        publisherSourceId: publisherSourceId ?? null,
        providerKey: input.providerKey,
        externalId: input.externalId,
        canonicalUrl: legacyItemCanonicalUrl(input.providerKey, input.externalId),
        availability: 'available' as const,
        syncState: 'fresh' as const,
        providerCategoryKey: input.providerCategory?.rawKey ?? null,
        providerCategoryLabel: input.providerCategory?.rawLabel ?? null,
        mappedCategory: input.providerCategory?.mappedCategory ?? null,
        displayName: input.name,
        image: input.image,
        price: input.price,
        popularityCount: input.popularityCount,
        nsfw: input.nsfw,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        lastCheckedAt: checkedAt,
        lastSuccessfulSyncAt: checkedAt,
        nextCheckAt: new Date(checkedAt.getTime() + SOURCE_FRESHNESS_MS),
        syncLeaseUntil: null,
        syncLeaseToken: null,
        lastErrorKind: null,
        lastErrorAt: null,
    }

    if (existingSource) {
        const catalogUpdates = {
            ...(input.displayNameOverride !== undefined
                ? { displayNameOverride: input.displayNameOverride }
                : {}),
            ...(input.categoryOverride
                ? {
                      categoryOverride: input.categoryOverride,
                      categoryOverrideOrigin: input.categoryOverrideOrigin ?? ('manual' as const),
                  }
                : {}),
        }
        if (Object.keys(catalogUpdates).length)
            statements.push(
                db
                    .update(catalogItems)
                    .set(catalogUpdates)
                    .where(eq(catalogItems.id, existingSource.itemId)),
            )
        statements.push(
            db.update(itemSources).set(sourceValues).where(eq(itemSources.id, existingSource.id)),
        )
        return {
            catalogItemId: existingSource.itemId,
            sourceId: existingSource.id,
            statements,
        }
    }

    const catalogItemId = crypto.randomUUID()
    const sourceId = crypto.randomUUID()
    statements.push(
        db.insert(catalogItems).values({
            id: catalogItemId,
            displayNameOverride: input.displayNameOverride ?? null,
            categoryOverride: input.categoryOverride ?? null,
            categoryOverrideOrigin: input.categoryOverride
                ? (input.categoryOverrideOrigin ?? 'manual')
                : null,
        }),
        db.insert(itemSources).values({
            id: sourceId,
            itemId: catalogItemId,
            primary: true,
            ...sourceValues,
        }),
    )
    return { catalogItemId, sourceId, statements }
}

export const updateCatalogCompatibilityEnrichment = async (
    db: AppDatabase,
    input: {
        providerKey: Platform
        externalId: string
        displayNameOverride: string | null
        categoryOverride?: ItemCategory
    },
) => {
    const [source] = await db
        .select({ itemId: itemSources.itemId })
        .from(itemSources)
        .where(
            and(
                eq(itemSources.providerKey, input.providerKey),
                eq(itemSources.externalId, input.externalId),
            ),
        )
        .limit(1)
    if (!source) return
    await db
        .update(catalogItems)
        .set({
            displayNameOverride: input.displayNameOverride,
            ...(input.categoryOverride
                ? {
                      categoryOverride: input.categoryOverride,
                      categoryOverrideOrigin: 'ai' as const,
                  }
                : {}),
        })
        .where(eq(catalogItems.id, source.itemId))
}

export const markCatalogCompatibilityWithdrawal = async (
    db: AppDatabase,
    input: { providerKey: Platform; externalId: string; errorKind: string; checkedAt?: Date },
) => {
    const checkedAt = input.checkedAt ?? new Date()
    const [source] = await db
        .update(itemSources)
        .set({
            availability: 'withdrawn',
            syncState: 'fresh',
            lastCheckedAt: checkedAt,
            nextCheckAt: new Date(checkedAt.getTime() + SOURCE_FRESHNESS_MS),
            lastErrorKind: input.errorKind,
            lastErrorAt: checkedAt,
            syncLeaseUntil: null,
            syncLeaseToken: null,
        })
        .where(
            and(
                eq(itemSources.providerKey, input.providerKey),
                eq(itemSources.externalId, input.externalId),
            ),
        )
        .returning({ itemId: itemSources.itemId })
    return source?.itemId
}
