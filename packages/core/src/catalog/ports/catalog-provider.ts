import type { PublisherSourceId } from '../../publishers/domain/publisher'
import type { ItemSourceSnapshot } from '../domain/catalog'

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
