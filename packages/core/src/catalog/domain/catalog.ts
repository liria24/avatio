import type { CategoryOverrideOrigin, ItemCategory } from './category'

export type CatalogItemId = string
export type ItemSourceId = string
export type PublisherId = string
export type PublisherSourceId = string

export const sourceAvailabilities = [
    'available',
    'withdrawn',
    'policy_rejected',
    'unknown',
] as const
export type SourceAvailability = (typeof sourceAvailabilities)[number]

export const syncStates = ['fresh', 'stale', 'syncing', 'error'] as const
export type SyncState = (typeof syncStates)[number]

export interface ProviderCategory {
    rawKey: string
    rawLabel?: string
    mappedCategory: ItemCategory | null
}

export interface CatalogItem {
    id: CatalogItemId
    primarySourceId: ItemSourceId | null
    displayNameOverride: string | null
    categoryOverride: ItemCategory | null
    categoryOverrideOrigin: CategoryOverrideOrigin | null
    createdAt: Date
    updatedAt: Date
}

export interface ItemSourceSnapshot {
    name: string
    image: string | null
    price: string | null
    popularityCount: number | null
    nsfw: boolean
    category: ProviderCategory | null
    metadata: Record<string, unknown>
}

export interface ItemSource {
    id: ItemSourceId
    itemId: CatalogItemId
    providerKey: string
    externalId: string
    canonicalUrl: string
    publisherSourceId: PublisherSourceId | null
    primary: boolean
    availability: SourceAvailability
    syncState: SyncState
    snapshot: ItemSourceSnapshot | null
    lastCheckedAt: Date | null
    lastSuccessfulSyncAt: Date | null
    nextCheckAt: Date | null
    syncLeaseUntil: Date | null
    syncLeaseToken: string | null
    lastErrorKind: string | null
    lastErrorAt: Date | null
}

export interface Publisher {
    id: PublisherId
    displayNameOverride: string | null
    imageOverride: string | null
    createdAt: Date
    updatedAt: Date
}

export interface PublisherSource {
    id: PublisherSourceId
    publisherId: PublisherId
    providerKey: string
    externalId: string
    canonicalUrl: string
    name: string
    image: string | null
    providerVerified: boolean
    metadata: Record<string, unknown>
}
