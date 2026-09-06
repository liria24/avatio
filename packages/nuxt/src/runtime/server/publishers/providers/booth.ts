import type {
    PublisherVerificationProvider,
    ResolvedPublisherVerificationTarget,
} from '@avatio/core/publishers'
import { matchBoothCatalogUrl } from '@avatio/nuxt/runtime/catalog/references'

import type { BoothResponse } from '../../catalog/providers/booth'
import type { ProviderHttpClient } from '../../catalog/providers/http'

export interface BoothVerificationProviderOptions {
    proxyBaseUrl: string
    http: ProviderHttpClient
}

export class BoothPublisherVerificationProvider implements PublisherVerificationProvider {
    readonly key = 'booth'

    constructor(private readonly options: BoothVerificationProviderOptions) {}

    async resolveTarget(url: URL): Promise<ResolvedPublisherVerificationTarget | null> {
        const reference = matchBoothCatalogUrl(url)
        if (!reference) return null

        const proxyBaseUrl = this.options.proxyBaseUrl.endsWith('/')
            ? this.options.proxyBaseUrl
            : `${this.options.proxyBaseUrl}/`
        const response = await this.options.http.get<BoothResponse>(
            new URL(encodeURIComponent(reference.externalId), proxyBaseUrl).href,
        )
        if (!response.ok || !response.data) throw new Error(`BOOTH returned ${response.status}.`)

        const item = response.data
        return {
            source: {
                providerKey: this.key,
                externalId: item.shop.subdomain,
                canonicalUrl: item.shop.url || `https://${item.shop.subdomain}.booth.pm/`,
                name: item.shop.name,
                image: item.shop.thumbnail_url || null,
                providerVerified: Boolean(item.shop.verified),
                metadata: {},
            },
            method: 'item-description',
            instruction: {
                type: 'item-description',
                url: `https://booth.pm/items/${item.id}`,
            },
            proof: item.description,
        }
    }

    async verify({ target, code }: Parameters<PublisherVerificationProvider['verify']>[0]) {
        return typeof target.proof === 'string' && target.proof.includes(code)
    }
}
