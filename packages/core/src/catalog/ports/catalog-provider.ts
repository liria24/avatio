import type { ItemSourceSnapshot } from '../domain/catalog'

export interface ExternalReference {
    providerKey: string
    externalId: string
    canonicalUrl: string
}

export interface ProviderPublisherSnapshot {
    externalId: string
    canonicalUrl: string
    name: string
    image: string | null
    providerVerified: boolean
    metadata: Record<string, unknown>
}

export interface ProviderSnapshot extends ItemSourceSnapshot {
    reference: ExternalReference
    publisher: ProviderPublisherSnapshot | null
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
