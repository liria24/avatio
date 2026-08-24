import type { CacheInvalidator } from '../../ports'
import type { CatalogRepository } from '../ports/catalog-repository'
import type { CatalogProviderRegistry } from './provider-registry'

export interface SyncCatalogSourceInput {
    sourceId: string
    repository: CatalogRepository
    providers: CatalogProviderRegistry
    cacheInvalidator: CacheInvalidator
    now?: Date
    freshnessMs?: number
    retryMs?: number
}

export const syncCatalogSource = async ({
    sourceId,
    repository,
    providers,
    cacheInvalidator,
    now = new Date(),
    freshnessMs = 24 * 60 * 60 * 1000,
    retryMs = 15 * 60 * 1000,
}: SyncCatalogSourceInput) => {
    const source = await repository.markSyncStarted(sourceId, now)
    if (!source) throw new Error(`Catalog source not found: ${sourceId}`)

    const provider = providers.get(source.providerKey)
    const result = provider
        ? await provider.fetch({
              providerKey: source.providerKey,
              externalId: source.externalId,
              canonicalUrl: source.canonicalUrl,
          })
        : { status: 'transient_error' as const, errorKind: 'provider-not-registered' }

    const definitive = result.status !== 'transient_error'
    const itemId = await repository.completeSourceSync({
        sourceId,
        availability: definitive ? result.status : undefined,
        snapshot: result.status === 'available' ? result.snapshot : undefined,
        checkedAt: now,
        nextCheckAt: new Date(now.getTime() + (definitive ? freshnessMs : retryMs)),
        successful: definitive,
        errorKind: result.status === 'available' ? undefined : result.errorKind,
    })

    let cacheInvalidationFailed = false
    if (definitive)
        try {
            await cacheInvalidator.invalidate({ items: [itemId] })
        } catch {
            cacheInvalidationFailed = true
        }
    return { itemId, result, cacheInvalidationFailed }
}
