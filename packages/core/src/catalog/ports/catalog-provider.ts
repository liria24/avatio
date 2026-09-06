import type { PublisherSourceId } from '../../publishers/domain/publisher'
import type { ItemSourceSnapshot } from '../domain/catalog'

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
    | { status: 'policy_rejected'; errorKind: string }
    | { status: 'transient_error'; errorKind: string; retryAt?: Date }

export interface CatalogProvider {
    readonly key: string
    matchUrl(url: URL): ExternalReference | null
    fetch(reference: ExternalReference): Promise<ProviderFetchResult>
}
