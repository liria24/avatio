import type {
    CatalogProvider,
    ExternalReference,
    ItemCategory,
    ProviderAdmissionDefinition,
    ProviderAdmissionSignal,
    ProviderFetchResult,
    ProviderSnapshot,
} from '@avatio/core/catalog'
import { matchBoothCatalogUrl } from '@avatio/nuxt/runtime/catalog/references'

import type { ProviderHttpClient, ResolvePublisherSource } from './http'
import { isConfirmedWithdrawalStatus, withdrawalErrorKind } from './http'

export interface BoothResponse {
    id: string | number
    url: string
    name: string
    description: string | null
    price: string
    wish_lists_count: number
    is_adult: boolean
    category: { id: number; name: string }
    images: { original: string }[]
    shop: {
        subdomain: string
        name: string
        thumbnail_url: string
        url: string
        verified: boolean
    }
    tags: { name: string; url: string }[]
    variations: { status: string }[]
}

export interface BoothProviderOptions {
    proxyBaseUrl?: string
    categoryMap: Readonly<Record<string, ItemCategory>>
    http: ProviderHttpClient
    resolvePublisherSource: ResolvePublisherSource
}

export const BOOTH_ADMISSION_DEFINITION = {
    match: 'any',
    facets: [
        { key: 'category', discovery: 'observed' },
        { key: 'tag', discovery: 'configured-only' },
    ],
} as const satisfies ProviderAdmissionDefinition

export const getBoothItemUrl = (externalId: string, proxyBaseUrl?: string) => {
    const encodedId = encodeURIComponent(externalId)
    if (!proxyBaseUrl) return `https://booth.pm/ja/items/${encodedId}.json`
    return new URL(encodedId, proxyBaseUrl.endsWith('/') ? proxyBaseUrl : `${proxyBaseUrl}/`).href
}

export class BoothCatalogProvider implements CatalogProvider {
    readonly key = 'booth'
    readonly admission = BOOTH_ADMISSION_DEFINITION

    constructor(private readonly options: BoothProviderOptions) {}

    matchUrl(url: URL): ExternalReference | null {
        return matchBoothCatalogUrl(url)
    }

    async fetch(reference: ExternalReference): Promise<ProviderFetchResult> {
        if (reference.providerKey !== this.key)
            return { status: 'transient_error', errorKind: 'provider-reference-mismatch' }

        let response
        try {
            response = await this.options.http.get<BoothResponse>(
                getBoothItemUrl(reference.externalId, this.options.proxyBaseUrl),
            )
        } catch {
            return { status: 'transient_error', errorKind: 'provider-network-error' }
        }

        if (isConfirmedWithdrawalStatus(response.status))
            return { status: 'withdrawn', errorKind: withdrawalErrorKind(response.status) }
        if (!response.ok)
            return {
                status: 'transient_error',
                errorKind: `provider-http-${response.status}`,
            }

        const item = response.data
        if (!item)
            return { status: 'transient_error', errorKind: 'provider-invalid-success-response' }

        const rawCategoryKey = String(item.category.id)
        const publisherSourceId = await this.options.resolvePublisherSource({
            providerKey: this.key,
            externalId: item.shop.subdomain,
            canonicalUrl: item.shop.url || `https://${item.shop.subdomain}.booth.pm/`,
            name: item.shop.name,
            image: item.shop.thumbnail_url || null,
            providerVerified: Boolean(item.shop.verified),
            metadata: {},
        })

        return {
            status: 'available',
            snapshot: {
                reference: {
                    providerKey: this.key,
                    externalId: String(item.id),
                    canonicalUrl: `https://booth.pm/items/${item.id}`,
                },
                name: item.name,
                image: item.images[0]?.original ?? null,
                price: item.variations.some(({ status }) => status === 'free_download')
                    ? 'FREE'
                    : item.price,
                popularityCount: Number(item.wish_lists_count) || 0,
                nsfw: Boolean(item.is_adult),
                category: {
                    rawKey: rawCategoryKey,
                    rawLabel: item.category.name,
                    mappedCategory: this.options.categoryMap[rawCategoryKey] ?? null,
                },
                metadata: { description: item.description, tags: item.tags },
                publisherSourceId,
            },
        }
    }

    getAdmissionSignals(snapshot: ProviderSnapshot): ProviderAdmissionSignal[] {
        const category = snapshot.category
        const tags = Array.isArray(snapshot.metadata.tags) ? snapshot.metadata.tags : []
        return [
            ...(category
                ? [
                      {
                          facetKey: 'category',
                          valueKey: category.rawKey,
                          label: category.rawLabel ?? category.rawKey,
                      },
                  ]
                : []),
            ...tags.flatMap((tag) => {
                if (!tag || typeof tag !== 'object' || !('name' in tag)) return []
                const signal = this.normalizeAdmissionValue('tag', String(tag.name))
                return signal ? [signal] : []
            }),
        ]
    }

    normalizeAdmissionValue(facetKey: string, value: string): ProviderAdmissionSignal | null {
        const label = value.trim().normalize('NFKC')
        if (facetKey !== 'tag' || !label) return null
        return { facetKey, valueKey: label.toLocaleLowerCase('en-US'), label }
    }
}
