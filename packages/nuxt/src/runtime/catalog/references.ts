import type { ExternalReference } from '@avatio/core/catalog'

export type CatalogReferenceMatcher = (url: URL) => ExternalReference | null

const isBoothHostname = (hostname: string) =>
    hostname === 'booth.pm' || hostname.endsWith('.booth.pm')

export const matchBoothCatalogUrl: CatalogReferenceMatcher = (url) => {
    if (!isBoothHostname(url.hostname.toLowerCase())) return null

    const match = url.pathname.match(/^\/(?:[a-z]{2}\/)?items?\/(\d+)(?:\/)?$/i)
    const externalId = match?.[1]
    if (!externalId) return null

    return {
        providerKey: 'booth',
        externalId,
        canonicalUrl: `https://booth.pm/items/${externalId}`,
    }
}

const githubRepositoryPattern = /^[\w-]+\/[\w.-]+$/

export const isGithubRepositoryId = (value: string) => githubRepositoryPattern.test(value)

export const matchGithubCatalogUrl: CatalogReferenceMatcher = (url) => {
    if (url.hostname.toLowerCase() !== 'github.com') return null

    const externalId = url.pathname.replace(/^\/+|\/+$/g, '')
    if (!isGithubRepositoryId(externalId)) return null

    return {
        providerKey: 'github',
        externalId,
        canonicalUrl: `https://github.com/${externalId}`,
    }
}

const catalogReferenceMatchers: readonly CatalogReferenceMatcher[] = [
    matchBoothCatalogUrl,
    matchGithubCatalogUrl,
]

const toUrl = (input: string | URL): URL | null => {
    if (input instanceof URL) return input

    try {
        return new URL(input)
    } catch {
        return null
    }
}

export const matchCatalogUrl = (input: string | URL): ExternalReference | null => {
    const url = toUrl(input)
    if (!url) return null

    for (const matcher of catalogReferenceMatchers) {
        const reference = matcher(url)
        if (reference) return reference
    }

    return null
}
