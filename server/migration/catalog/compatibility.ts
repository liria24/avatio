import { catalogItems, items, itemSources, publisherSources, publishers } from '@@/database/schema'
import type { ItemCategory } from '@avatio/core/catalog'
import { and, eq, inArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { AppDatabase } from '~~/server/utils/database'
import { platformSchema, type Platform, type SetupItem } from '~~/shared/types/database'

import { legacyItemCanonicalUrl, legacyPublisherCanonicalUrl } from './legacy'

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

const metadataNumber = (metadata: Record<string, unknown> | null, key: string) => {
    const value = metadata?.[key]
    return typeof value === 'number' ? value : undefined
}

const metadataString = (metadata: Record<string, unknown> | null, key: string) => {
    const value = metadata?.[key]
    return typeof value === 'string' ? value : undefined
}

const metadataContributors = (metadata: Record<string, unknown> | null) => {
    const contributors = metadata?.contributors
    if (!Array.isArray(contributors)) return undefined
    return contributors.flatMap((contributor) => {
        if (!contributor || typeof contributor !== 'object') return []
        const name = Reflect.get(contributor, 'name')
        const avatar = Reflect.get(contributor, 'avatar')
        if (typeof name !== 'string') return []
        return [{ name, ...(typeof avatar === 'string' ? { avatar } : {}) }]
    })
}

interface LegacySetupItemProjectionInput {
    source: {
        providerKey: string
        externalId: string
        displayName: string
        image: string | null
        price: string | null
        popularityCount: number | null
        nsfw: boolean
        metadata: Record<string, unknown> | null
        publisherSource: {
            externalId: string
            name: string
            image: string | null
            providerVerified: boolean
        } | null
    }
    displayNameOverride: string | null
    category: ItemCategory
    unsupported: boolean
    note: string | null
    shapekeys: SetupItem['shapekeys']
}

/**
 * Temporary adapter for the pre-v2 client shape. Unknown providers are absent
 * only because that legacy DTO has a closed platform union; the v2 Catalog and
 * Setup domains do not branch on provider keys.
 */
export const projectCatalogSourceToLegacySetupItem = (
    input: LegacySetupItemProjectionInput,
): SetupItem | null => {
    const platform = platformSchema.safeParse(input.source.providerKey)
    if (!platform.success) return null

    const publisher = input.source.publisherSource
    return {
        id: input.source.externalId,
        platform: platform.data,
        category: input.category,
        name: input.source.displayName,
        niceName: input.displayNameOverride,
        image: input.source.image,
        price: input.source.price,
        likes: input.source.popularityCount,
        nsfw: input.source.nsfw,
        outdated: false,
        shop: publisher
            ? {
                  id: publisher.externalId,
                  platform: platform.data,
                  name: publisher.name,
                  image: publisher.image,
                  verified: publisher.providerVerified,
              }
            : null,
        unsupported: input.unsupported,
        note: input.note,
        shapekeys: input.shapekeys,
        forks: metadataNumber(input.source.metadata, 'forks'),
        version: metadataString(input.source.metadata, 'version'),
        contributors: metadataContributors(input.source.metadata),
    }
}

export interface LegacySetupItemWrite {
    id: string
    setupId: string
    itemId: string
    category?: ItemCategory | null
    unsupported?: boolean
    note?: string | null
}

/** Temporary rollout dual-write bridge from legacy Setup inputs to SetupEntry rows. */
export const mapV2SetupEntryWrites = async (db: AppDatabase, entries: LegacySetupItemWrite[]) => {
    if (!entries.length) return []
    const externalIds = [...new Set(entries.map((entry) => entry.itemId))]
    const [legacyItems, sources] = await Promise.all([
        db
            .select({ id: items.id, platform: items.platform })
            .from(items)
            .where(inArray(items.id, externalIds)),
        db
            .select({
                itemId: itemSources.itemId,
                providerKey: itemSources.providerKey,
                externalId: itemSources.externalId,
            })
            .from(itemSources)
            .where(inArray(itemSources.externalId, externalIds)),
    ])
    const providerByExternalId = new Map(legacyItems.map((item) => [item.id, item.platform]))
    const catalogItemByExternalId = new Map(
        sources.flatMap((source) =>
            providerByExternalId.get(source.externalId) === source.providerKey
                ? [[source.externalId, source.itemId] as const]
                : [],
        ),
    )
    if (entries.some((entry) => !catalogItemByExternalId.has(entry.itemId))) return null

    return entries.map((entry) => ({
        id: entry.id,
        setupId: entry.setupId,
        itemId: catalogItemByExternalId.get(entry.itemId)!,
        categoryOverride: entry.category ?? null,
        unsupported: entry.unsupported ?? false,
        note: entry.note ?? null,
    }))
}
