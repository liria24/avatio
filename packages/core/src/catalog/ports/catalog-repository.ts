import type {
    CatalogItem,
    CatalogItemId,
    ItemSource,
    ItemSourceId,
    SourceAvailability,
} from '../domain/catalog'
import type { ProviderSnapshot } from './catalog-provider'

export interface SourceLease {
    sourceId: ItemSourceId
    token: string
    expiresAt: Date
}

export interface CatalogRepository {
    findItem(id: CatalogItemId): Promise<CatalogItem | null>
    findSource(id: ItemSourceId): Promise<ItemSource | null>
    findSourceByExternalId(providerKey: string, externalId: string): Promise<ItemSource | null>
    scheduleSourceCheck(id: ItemSourceId, now: Date): Promise<boolean>
    claimDueSource(id: ItemSourceId, now: Date, leaseUntil: Date): Promise<SourceLease | null>
    releaseSourceLease(lease: SourceLease): Promise<void>
    markSyncStarted(id: ItemSourceId, now: Date): Promise<ItemSource | null>
    completeSourceSync(input: {
        sourceId: ItemSourceId
        availability?: SourceAvailability
        snapshot?: ProviderSnapshot
        checkedAt: Date
        nextCheckAt: Date
        successful: boolean
        errorKind?: string
    }): Promise<CatalogItemId>
}
