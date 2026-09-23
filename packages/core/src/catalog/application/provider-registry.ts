import type { CatalogProvider, ExternalReference } from '../ports/catalog-provider'

export class CatalogProviderRegistry {
    readonly #providers: ReadonlyMap<string, CatalogProvider>

    constructor(providers: readonly CatalogProvider[]) {
        const entries = providers.map((provider) => [provider.key, provider] as const)
        const keys = new Set(entries.map(([key]) => key))
        if (keys.size !== entries.length) throw new Error('Catalog provider keys must be unique.')
        this.#providers = new Map(entries)
    }

    get(key: string): CatalogProvider | null {
        return this.#providers.get(key) ?? null
    }

    matchUrl(url: URL): ExternalReference | null {
        for (const provider of this.#providers.values()) {
            const reference = provider.matchUrl(url)
            if (reference) return reference
        }
        return null
    }

    keys(): string[] {
        return [...this.#providers.keys()]
    }

    values(): CatalogProvider[] {
        return [...this.#providers.values()]
    }
}
