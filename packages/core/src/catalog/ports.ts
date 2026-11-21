import type { PublisherSourceId } from '../publishers/domain/publisher'
import type {
    CatalogClassification,
    CatalogClassificationLease,
    CatalogItem,
    CatalogItemId,
    ItemSource,
    ItemSourceId,
    ItemSourceSnapshot,
    SourceAvailability,
} from './domain/catalog'
import type { CatalogClassificationChoice } from './domain/category'

export const providerAdmissionDiscoveries = ['observed', 'configured-only'] as const
export type ProviderAdmissionDiscovery = (typeof providerAdmissionDiscoveries)[number]
export const providerAdmissionMatches = ['any', 'all'] as const
export type ProviderAdmissionMatch = (typeof providerAdmissionMatches)[number]
export const providerAdmissionDecisions = ['allow', 'deny'] as const
export type ProviderAdmissionDecision = (typeof providerAdmissionDecisions)[number]

export interface ProviderAdmissionFacet {
    key: string
    discovery: ProviderAdmissionDiscovery
}

export interface ProviderAdmissionDefinition {
    match: ProviderAdmissionMatch
    facets: readonly ProviderAdmissionFacet[]
}

export interface ProviderAdmissionSignal {
    facetKey: string
    valueKey: string
    label: string
}

export interface ProviderAdmissionRule {
    facetKey: string
    valueKey: string
    decision: ProviderAdmissionDecision
}

export interface ExternalReference {
    providerKey: string
    externalId: string
    canonicalUrl: string
}

export interface ProviderSnapshot extends ItemSourceSnapshot {
    reference: ExternalReference
    publisherSourceId: PublisherSourceId | null
}

export type ProviderFetchResult =
    | { status: 'available'; snapshot: ProviderSnapshot }
    | { status: 'withdrawn'; errorKind: string }
    | { status: 'policy_rejected'; errorKind: string; snapshot?: ProviderSnapshot }
    | { status: 'transient_error'; errorKind: string; retryAt?: Date }

export interface CatalogProvider {
    readonly key: string
    readonly admission?: ProviderAdmissionDefinition
    matchUrl(url: URL): ExternalReference | null
    fetch(reference: ExternalReference): Promise<ProviderFetchResult>
    getAdmissionSignals?(snapshot: ProviderSnapshot): readonly ProviderAdmissionSignal[]
    normalizeAdmissionValue?(facetKey: string, value: string): ProviderAdmissionSignal | null
}

export interface SourceLease {
    sourceId: ItemSourceId
    token: string
    expiresAt: Date
}

export interface CatalogRepository {
    findProviderAdmissionRules(providerKey: string): Promise<ProviderAdmissionRule[]>
    observeProviderAdmissionOptions(
        providerKey: string,
        signals: readonly ProviderAdmissionSignal[],
        observedAt: Date,
    ): Promise<void>
    ensureSource(reference: ExternalReference): Promise<ItemSource>
    findItem(id: CatalogItemId): Promise<CatalogItem | null>
    findSource(id: ItemSourceId): Promise<ItemSource | null>
    findSourceByExternalId(providerKey: string, externalId: string): Promise<ItemSource | null>
    findClassification(itemId: CatalogItemId): Promise<CatalogClassification | null>
    claimClassification(input: {
        itemId: CatalogItemId
        sourceId: ItemSourceId
        sourceUpdatedAt: Date
        inputHash: string
        classifierVersion: string
        requestedModel: string
        now: Date
        leaseUntil: Date
    }): Promise<CatalogClassificationLease | null>
    completeClassification(input: {
        lease: CatalogClassificationLease
        responseModel: string
        category: CatalogClassificationChoice
        confidence: number
        probabilities: Record<string, number>
        accepted: boolean
        completedAt: Date
    }): Promise<void>
    failClassification(input: {
        lease: CatalogClassificationLease
        errorKind: string
        retryAt: Date
        failedAt: Date
    }): Promise<void>
    scheduleSourceCheck(id: ItemSourceId, now: Date): Promise<boolean>
    claimDueSource(
        id: ItemSourceId,
        now: Date,
        leaseUntil: Date,
        force?: boolean,
    ): Promise<SourceLease | null>
    releaseSourceLease(lease: SourceLease): Promise<void>
    markSyncStarted(id: ItemSourceId, leaseToken: string, now: Date): Promise<ItemSource | null>
    completeSourceSync(input: {
        sourceId: ItemSourceId
        leaseToken: string
        availability?: SourceAvailability
        snapshot?: ProviderSnapshot
        checkedAt: Date
        nextCheckAt: Date
        successful: boolean
        errorKind?: string
    }): Promise<CatalogItemId | null>
}

export interface CatalogSyncMessage {
    version: 2
    type: 'catalog.sync-source'
    sourceId: ItemSourceId
    leaseToken: string
}

export interface CatalogSyncQueue {
    enqueue(message: CatalogSyncMessage): Promise<void>
}
