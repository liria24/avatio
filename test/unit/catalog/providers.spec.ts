import { CatalogProviderRegistry, type CatalogProvider } from '@avatio/core/catalog'
import {
    BoothCatalogProvider,
    GithubCatalogProvider,
    type ProviderHttpClient,
    type ProviderHttpResponse,
} from '@avatio/nuxt/runtime/server/catalog/providers'

const response = <T>(status: number, data: T | null): ProviderHttpResponse<T> => ({
    status,
    ok: status >= 200 && status < 300,
    data,
})

const boothItem = {
    id: '12345',
    url: 'https://booth.pm/items/12345',
    name: 'Avatar',
    description: 'Description',
    price: '1200 JPY',
    wish_lists_count: 12,
    is_adult: false,
    category: { id: 208, name: '3D Characters' },
    images: [{ original: 'https://example.com/item.png' }],
    shop: {
        subdomain: 'creator',
        name: 'Creator',
        thumbnail_url: 'https://example.com/shop.png',
        url: 'https://creator.booth.pm/',
        verified: true,
    },
    tags: [{ name: 'VRChat', url: 'https://booth.pm/tags/VRChat' }],
    variations: [{ status: 'free_download' }],
}

const createHttp = (
    implementation: (url: string) => Promise<ProviderHttpResponse<unknown>>,
): ProviderHttpClient => ({ get: implementation as ProviderHttpClient['get'] })
const resolvePublisherSource = async (snapshot: { providerKey: string; externalId: string }) =>
    `${snapshot.providerKey}:${snapshot.externalId}`

describe('BOOTH CatalogProvider', () => {
    it.each([
        'https://booth.pm/items/12345',
        'https://booth.pm/ja/items/12345',
        'https://creator.booth.pm/items/12345',
    ])('matches and canonicalizes %s', (value) => {
        const provider = new BoothCatalogProvider({
            proxyBaseUrl: 'https://proxy.example/',
            allowedCategoryKeys: new Set(['208']),
            categoryMap: { '208': 'avatar' },
            http: createHttp(async () => response(200, boothItem)),
            resolvePublisherSource,
        })
        expect(provider.matchUrl(new URL(value))).toEqual({
            providerKey: 'booth',
            externalId: '12345',
            canonicalUrl: 'https://booth.pm/items/12345',
        })
        expect(provider.matchUrl(new URL('https://evilbooth.pm/items/12345'))).toBeNull()
    })

    it.each(['12345', 12345])('normalizes an admitted provider snapshot with ID %s', async (id) => {
        const provider = new BoothCatalogProvider({
            proxyBaseUrl: 'https://proxy.example/api',
            allowedCategoryKeys: new Set(['208']),
            categoryMap: { '208': 'avatar' },
            http: createHttp(async (url) => {
                expect(url).toBe('https://proxy.example/api/12345')
                return response(200, { ...boothItem, id })
            }),
            resolvePublisherSource,
        })
        const result = await provider.fetch({
            providerKey: 'booth',
            externalId: '12345',
            canonicalUrl: 'https://booth.pm/items/12345',
        })
        expect(result.status).toBe('available')
        if (result.status !== 'available') return
        expect(result.snapshot.reference.externalId).toBe('12345')
        expect(result.snapshot.category).toEqual({
            rawKey: '208',
            rawLabel: '3D Characters',
            mappedCategory: 'avatar',
        })
        expect(result.snapshot.price).toBe('FREE')
        expect(result.snapshot.publisherSourceId).toBe('booth:creator')
    })

    it.each([
        [404, 'withdrawn'],
        [410, 'withdrawn'],
        [500, 'transient_error'],
        [502, 'transient_error'],
    ] as const)('maps HTTP %i to %s', async (status, expected) => {
        const provider = new BoothCatalogProvider({
            proxyBaseUrl: 'https://proxy.example/',
            allowedCategoryKeys: new Set(['208']),
            categoryMap: { '208': 'avatar' },
            http: createHttp(async () => response(status, null)),
            resolvePublisherSource,
        })
        const result = await provider.fetch({
            providerKey: 'booth',
            externalId: '12345',
            canonicalUrl: 'https://booth.pm/items/12345',
        })
        expect(result.status).toBe(expected)
    })

    it('keeps policy rejection separate from withdrawal', async () => {
        const provider = new BoothCatalogProvider({
            proxyBaseUrl: 'https://proxy.example/',
            allowedCategoryKeys: new Set(),
            categoryMap: {},
            http: createHttp(async () => response(200, boothItem)),
            resolvePublisherSource,
        })
        const result = await provider.fetch({
            providerKey: 'booth',
            externalId: '12345',
            canonicalUrl: 'https://booth.pm/items/12345',
        })
        expect(result.status).toBe('policy_rejected')
    })
})

describe('GitHub CatalogProvider', () => {
    const reference = {
        providerKey: 'github',
        externalId: 'owner/repository',
        canonicalUrl: 'https://github.com/owner/repository',
    }

    it('matches only a GitHub owner/repository URL', () => {
        const provider = new GithubCatalogProvider({
            http: createHttp(async () => response(404, null)),
            resolvePublisherSource,
        })
        expect(provider.matchUrl(new URL('https://github.com/owner/repository/'))).toEqual(
            reference,
        )
        expect(provider.matchUrl(new URL('https://github.com/owner'))).toBeNull()
        expect(
            provider.matchUrl(new URL('https://github.com.evil.test/owner/repository')),
        ).toBeNull()
    })

    it.each([
        [404, 'withdrawn'],
        [410, 'withdrawn'],
        [500, 'transient_error'],
    ] as const)('maps repository HTTP %i to %s', async (status, expected) => {
        const provider = new GithubCatalogProvider({
            http: createHttp(async () => response(status, null)),
            resolvePublisherSource,
        })
        expect((await provider.fetch(reference)).status).toBe(expected)
    })

    it('treats a proxy exception or empty successful response as transient', async () => {
        const throwing = new GithubCatalogProvider({
            http: createHttp(async () => {
                throw new Error('network unavailable')
            }),
            resolvePublisherSource,
        })
        const empty = new GithubCatalogProvider({
            http: createHttp(async () => response(200, null)),
            resolvePublisherSource,
        })
        expect((await throwing.fetch(reference)).status).toBe('transient_error')
        expect((await empty.fetch(reference)).status).toBe('transient_error')
    })

    it('refreshes a retained alias through the observed canonical repository name', async () => {
        const requested: string[] = []
        const provider = new GithubCatalogProvider({
            http: createHttp(async (url) => {
                requested.push(url)
                return response(404, null)
            }),
            resolvePublisherSource,
        })
        await provider.fetch({ ...reference, canonicalUrl: 'https://github.com/new-owner/renamed' })
        expect(requested).toEqual(['https://ungh.cc/repos/new-owner/renamed'])
    })

    it('normalizes the primary response without making auxiliary data authoritative', async () => {
        const provider = new GithubCatalogProvider({
            http: createHttp(async (url) => {
                if (url.endsWith('/contributors')) throw new Error('optional endpoint failed')
                if (url.endsWith('/releases/latest')) return response(404, null)
                if (url.endsWith('/readme')) return response(200, { markdown: '# Readme' })
                return response(200, {
                    repo: {
                        name: 'repository',
                        repo: 'owner/repository',
                        description: 'Description',
                        stars: 50,
                        forks: 5,
                    },
                })
            }),
            resolvePublisherSource,
        })
        const result = await provider.fetch(reference)
        expect(result.status).toBe('available')
        if (result.status !== 'available') return
        expect(result.snapshot.popularityCount).toBe(50)
        expect(result.snapshot.metadata).toMatchObject({
            forks: 5,
            readme: '# Readme',
            contributors: [],
        })
    })
})

describe('CatalogProviderRegistry', () => {
    it('adds a provider without any Setup-domain change', () => {
        const futureProvider: CatalogProvider = {
            key: 'future',
            matchUrl: (url) =>
                url.hostname === 'catalog.example'
                    ? {
                          providerKey: 'future',
                          externalId: url.pathname.slice(1),
                          canonicalUrl: url.href,
                      }
                    : null,
            fetch: async () => ({ status: 'transient_error', errorKind: 'not-implemented' }),
        }
        const registry = new CatalogProviderRegistry([futureProvider])
        expect(registry.keys()).toEqual(['future'])
        expect(registry.matchUrl(new URL('https://catalog.example/item-1'))?.externalId).toBe(
            'item-1',
        )
    })
})
