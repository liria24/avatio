import type { CatalogProvider } from '../ports/catalog-provider'

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

    values(): CatalogProvider[] {
        return [...this.#providers.values()]
    }
}
