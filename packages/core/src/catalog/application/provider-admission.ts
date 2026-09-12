import type {
    CatalogProvider,
    ProviderAdmissionRule,
    ProviderSnapshot,
} from '../ports/catalog-provider'
import type { CatalogRepository } from '../ports/catalog-repository'

export const evaluateProviderAdmission = (
    provider: CatalogProvider,
    snapshot: ProviderSnapshot,
    rules: readonly ProviderAdmissionRule[],
) => {
    const definition = provider.admission
    if (!definition) return true
    const signals = provider.getAdmissionSignals?.(snapshot) ?? []
    const facetMatches = definition.facets.map(({ key }) =>
        signals.some(
            (signal) =>
                signal.facetKey === key &&
                rules.some(
                    (rule) =>
                        rule.facetKey === key &&
                        rule.valueKey === signal.valueKey &&
                        rule.decision === 'allow',
                ),
        ),
    )
    return definition.match === 'all' ? facetMatches.every(Boolean) : facetMatches.some(Boolean)
}

export const applyProviderAdmission = async (
    provider: CatalogProvider,
    snapshot: ProviderSnapshot,
    repository: CatalogRepository,
    observedAt: Date,
) => {
    const definition = provider.admission
    if (!definition) return true
    const signals = provider.getAdmissionSignals?.(snapshot) ?? []
    const observedFacets = new Set(
        definition.facets.filter(({ discovery }) => discovery === 'observed').map(({ key }) => key),
    )
    await repository.observeProviderAdmissionOptions(
        provider.key,
        signals.filter(({ facetKey }) => observedFacets.has(facetKey)),
        observedAt,
    )
    return evaluateProviderAdmission(
        provider,
        snapshot,
        await repository.findProviderAdmissionRules(provider.key),
    )
}
