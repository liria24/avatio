import type { CacheInvalidator } from '../../ports'
import type { ProviderSnapshot } from '../ports/catalog-provider'
import type { CatalogRepository } from '../ports/catalog-repository'
import { applyProviderAdmission } from './provider-admission'
import type { CatalogProviderRegistry } from './provider-registry'

export interface SyncCatalogSourceInput {
    sourceId: string
    leaseToken: string
    repository: CatalogRepository
    providers: CatalogProviderRegistry
    cacheInvalidator: CacheInvalidator
    initialSnapshot?: ProviderSnapshot
    now?: Date
    freshnessMs?: number
    retryMs?: number
}

export const syncCatalogSource = async ({
    sourceId,
    leaseToken,
    repository,
    providers,
    cacheInvalidator,
    initialSnapshot,
    now = new Date(),
    freshnessMs = 24 * 60 * 60 * 1000,
    retryMs = 15 * 60 * 1000,
}: SyncCatalogSourceInput) => {
    const source = await repository.markSyncStarted(sourceId, leaseToken, now)
    if (!source) return { stale: true as const, cacheInvalidationFailed: false }

    const provider = providers.get(source.providerKey)
    const fetched = initialSnapshot
        ? { status: 'available' as const, snapshot: initialSnapshot }
        : provider
          ? await provider.fetch({
                providerKey: source.providerKey,
                externalId: source.externalId,
                canonicalUrl: source.canonicalUrl,
            })
          : { status: 'transient_error' as const, errorKind: 'provider-not-registered' }
    const result =
        fetched.status === 'available' && provider
            ? (await applyProviderAdmission(provider, fetched.snapshot, repository, now))
                ? fetched
                : {
                      status: 'policy_rejected' as const,
                      errorKind: 'provider-admission-rejected',
                      snapshot: fetched.snapshot,
                  }
            : fetched

    const definitive = result.status !== 'transient_error'
    const itemId = await repository.completeSourceSync({
        sourceId,
        leaseToken,
        availability: definitive ? result.status : undefined,
        snapshot:
            result.status === 'available' || result.status === 'policy_rejected'
                ? result.snapshot
                : undefined,
        checkedAt: now,
        nextCheckAt: new Date(now.getTime() + (definitive ? freshnessMs : retryMs)),
        successful: definitive,
        errorKind: result.status === 'available' ? undefined : result.errorKind,
    })
    if (!itemId) return { stale: true as const, cacheInvalidationFailed: false }

    let cacheInvalidationFailed = false
    if (definitive)
        try {
            await cacheInvalidator.invalidate({ items: [itemId] })
        } catch {
            cacheInvalidationFailed = true
        }
    return { stale: false as const, itemId, result, cacheInvalidationFailed }
}
