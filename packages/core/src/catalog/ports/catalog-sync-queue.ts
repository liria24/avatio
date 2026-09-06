import type { ItemSourceId } from '../domain/catalog'

export interface CatalogSyncMessage {
    version: 2
    type: 'catalog.sync-source'
    sourceId: ItemSourceId
    leaseToken: string
}

export interface CatalogSyncQueue {
    enqueue(message: CatalogSyncMessage): Promise<void>
}
