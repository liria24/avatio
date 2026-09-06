import type {
    PublisherVerificationProvider,
    ResolvedPublisherVerificationTarget,
} from '../ports/publisher-verification-provider'

export class PublisherVerificationProviderRegistry {
    readonly #providers: ReadonlyMap<string, PublisherVerificationProvider>

    constructor(providers: readonly PublisherVerificationProvider[]) {
        this.#providers = new Map(providers.map((provider) => [provider.key, provider]))
        if (this.#providers.size !== providers.length)
            throw new Error('Duplicate publisher verification provider key.')
    }

    get(key: string) {
        return this.#providers.get(key) ?? null
    }

    async resolve(url: URL): Promise<{
        provider: PublisherVerificationProvider
        target: ResolvedPublisherVerificationTarget
    } | null> {
        for (const provider of this.#providers.values()) {
            const target = await provider.resolveTarget(url)
            if (target) return { provider, target }
        }
        return null
    }
}
