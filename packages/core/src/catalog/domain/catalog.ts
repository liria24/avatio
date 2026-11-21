import type { PublisherSourceId } from '../../publishers/domain/publisher'
import type { CatalogClassificationChoice, CategoryOverrideOrigin, ItemCategory } from './category'

export type CatalogItemId = string
export type ItemSourceId = string

export const catalogClassificationStatuses = [
    'processing',
    'resolved',
    'uncertain',
    'error',
] as const
export type CatalogClassificationStatus = (typeof catalogClassificationStatuses)[number]

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
    updatedAt: Date
}

export interface CatalogClassification {
    itemId: CatalogItemId
    sourceId: ItemSourceId
    sourceUpdatedAt: Date
    inputHash: string
    classifierVersion: string
    requestedModel: string
    responseModel: string | null
    status: CatalogClassificationStatus
    category: CatalogClassificationChoice | null
    confidence: number | null
    probabilities: Record<string, number> | null
    errorKind: string | null
    retryAt: Date | null
    leaseToken: string | null
    leaseUntil: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface CatalogClassificationLease {
    itemId: CatalogItemId
    sourceId: ItemSourceId
    sourceUpdatedAt: Date
    inputHash: string
    classifierVersion: string
    requestedModel: string
    token: string
    expiresAt: Date
}
