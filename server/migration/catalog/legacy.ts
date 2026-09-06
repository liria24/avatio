import type { ItemCategory } from '@avatio/core/catalog'

/** Migration-only conversion from retained legacy Catalog rows into v2 state. */

export const LEGACY_SOURCE_FRESHNESS_MS = 24 * 60 * 60 * 1000

export interface LegacyItemMigrationInput {
    id: string
    platform: string
    createdAt: Date
    updatedAt: Date
    outdated: boolean
    name: string
    niceName: string | null
    category: ItemCategory
    image: string | null
    price: string | null
    likes: number | null
    nsfw: boolean
}

export const migrateLegacyItemState = (
    item: LegacyItemMigrationInput,
    explicitCategoryOverride?: ItemCategory,
) => ({
    catalog: {
        displayNameOverride: item.niceName,
        categoryOverride: explicitCategoryOverride ?? item.category,
        categoryOverrideOrigin: explicitCategoryOverride
            ? ('manual' as const)
            : ('legacy' as const),
    },
    source: {
        providerKey: item.platform,
        externalId: item.id,
        availability: item.outdated ? ('unknown' as const) : ('available' as const),
        syncState: item.outdated ? ('stale' as const) : ('fresh' as const),
        displayName: item.name,
        image: item.image,
        price: item.price,
        popularityCount: item.likes,
        nsfw: item.nsfw,
        lastCheckedAt: item.updatedAt,
        lastSuccessfulSyncAt: item.outdated ? null : item.updatedAt,
        nextCheckAt: item.outdated
            ? new Date(0)
            : new Date(item.updatedAt.getTime() + LEGACY_SOURCE_FRESHNESS_MS),
        lastErrorKind: item.outdated ? 'legacy-unconfirmed-outdated' : null,
        lastErrorAt: item.outdated ? item.updatedAt : null,
    },
})

export const migrateLegacySetupEntry = <
    T extends {
        id: string
        setupId: string
        category: ItemCategory | null
        unsupported: boolean
        note: string | null
    },
>(
    entry: T,
    catalogItemId: string,
) => ({
    id: entry.id,
    itemId: catalogItemId,
    setupId: entry.setupId,
    categoryOverride: entry.category,
    unsupported: entry.unsupported,
    note: entry.note,
})

export const migrateLegacyShapekey = (shapekey: {
    id: number
    setupItemId: string
    name: string
    value: number
}) => ({
    id: shapekey.id,
    setupEntryId: shapekey.setupItemId,
    name: shapekey.name,
    value: shapekey.value,
})

export const legacyItemCanonicalUrl = (providerKey: string, externalId: string) => {
    if (providerKey === 'booth') return `https://booth.pm/items/${encodeURIComponent(externalId)}`
    if (providerKey === 'github') return `https://github.com/${externalId}`
    throw new Error(`Unsupported legacy provider: ${providerKey}`)
}

export const legacyPublisherCanonicalUrl = (providerKey: string, externalId: string) => {
    if (providerKey === 'booth') return `https://${externalId}.booth.pm/`
    if (providerKey === 'github') return `https://github.com/${externalId}`
    throw new Error(`Unsupported legacy provider: ${providerKey}`)
}
