import type {
    CatalogClassification,
    CatalogClassificationLease,
    CatalogItem,
    CatalogItemId,
    ItemSource,
    ItemSourceId,
    SourceAvailability,
} from '../domain/catalog'
import type { CatalogClassificationChoice } from '../domain/category'
import type {
    ExternalReference,
    ProviderAdmissionRule,
    ProviderAdmissionSignal,
    ProviderSnapshot,
} from './catalog-provider'

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
