import {
    syncCatalogSource,
    type CatalogRepository,
    type ItemSource,
    type ProviderSnapshot,
} from '@avatio/core/catalog'
import { matchCatalogReference } from '@avatio/nuxt/runtime/catalog/references'
import type { H3Event } from '@nuxt/nitro-server/h3'
import { and, eq, isNull } from 'drizzle-orm'
import { catalogItems } from '~~/database/schema'
import type { CatalogItemView } from '~~/shared/types/catalog'

const log = logger('resolveCatalogReference')

const scheduleCatalogDisplayName = (
    event: H3Event,
    db: AppDatabase,
    source: ItemSource,
    item: CatalogItemView | null,
) => {
    if (import.meta.dev || !source.snapshot || item?.displayNameOverride) return
    const snapshot = source.snapshot
    runAfterResponse(
        (async () => {
            try {
                const displayName = await generateCatalogDisplayName(db, {
                    name: snapshot.name,
                    description: {
                        description:
                            typeof snapshot.metadata.description === 'string'
                                ? snapshot.metadata.description
                                : '',
                        readme:
                            typeof snapshot.metadata.readme === 'string'
                                ? snapshot.metadata.readme
                                : undefined,
                    },
                })
                const [updated] = await db
                    .update(catalogItems)
                    .set({ displayNameOverride: displayName })
                    .where(
                        and(
                            eq(catalogItems.id, source.itemId),
                            isNull(catalogItems.displayNameOverride),
                        ),
                    )
                    .returning({ id: catalogItems.id })
                if (updated)
                    await invalidateCacheResources(
                        event,
                        { items: [source.itemId], collections: [EDGE_CACHE_TAGS.items] },
                        'catalog display name',
                    )
            } catch (error) {
                log.warn('Catalog display name generation failed', {
                    sourceId: source.id,
                    error: String(error),
                })
            }
        })(),
    )
}

const finishCatalogResolution = async (
    event: H3Event,
    db: AppDatabase,
    repository: CatalogRepository,
    source: ItemSource,
) => {
    await classifyCatalogSource(event, repository, source)
    const item = await queryCatalogItem(db, source.itemId)
    scheduleCatalogDisplayName(event, db, source, item)
    runAfterResponse(enqueueReferencedCatalogSources([source.itemId]))
    return item
}

export const resolveCatalogReference = async (
    event: H3Event,
    db: AppDatabase,
    input: string,
    userId: string,
) => {
    const knownItem = await queryCatalogItem(db, input)
    if (knownItem) {
        runAfterResponse(enqueueReferencedCatalogSources([knownItem.id]))
        return knownItem
    }
    const reference = matchCatalogReference(input)
    if (!reference)
        throw serverError.badRequest({ responseMessage: 'Unsupported catalog reference.' })
    await enforceRateLimit({ binding: 'RATE_LIMIT_ITEM_RESOLUTION', key: userId })
    const repository = getCatalogRepository()
    let source = await repository.findSourceByExternalId(
        reference.providerKey,
        reference.externalId,
    )
    if (source?.availability === 'available')
        return finishCatalogResolution(event, db, repository, source)
    if (source?.nextCheckAt && source.nextCheckAt > new Date()) {
        if (source.availability === 'unknown' || source.syncState === 'error')
            throw createError({
                statusCode: 503,
                message: 'The provider is temporarily unavailable.',
            })
        throw serverError.notFound({ responseMessage: 'The provider source is unavailable.' })
    }
    const providers = await getCatalogProviderRegistry()
    const cacheInvalidator = getCacheInvalidator(event)
    let initialSnapshot: ProviderSnapshot | undefined
    if (!source) {
        const provider = providers.get(reference.providerKey)
        if (!provider)
            throw serverError.badRequest({ responseMessage: 'Unsupported catalog provider.' })
        const resolved = await provider.fetch(reference)
        if (resolved.status === 'transient_error')
            throw createError({
                statusCode: 503,
                message: 'The provider is temporarily unavailable.',
            })
        if (resolved.status !== 'available')
            throw serverError.notFound({ responseMessage: 'The provider source is unavailable.' })
        // Discover the canonical provider identity before creating an Avatio ID.
        initialSnapshot = resolved.snapshot
        source = await repository.ensureSource(initialSnapshot.reference)
        if (source.availability === 'available')
            return finishCatalogResolution(event, db, repository, source)
    }
    const now = new Date()
    const lease = await repository.claimDueSource(
        source.id,
        now,
        new Date(now.getTime() + 30 * 60 * 1000),
        true,
    )
    if (!lease)
        throw createError({ statusCode: 503, message: 'This catalog source is being refreshed.' })
    const result = await syncCatalogSource({
        sourceId: source.id,
        leaseToken: lease.token,
        repository,
        providers,
        cacheInvalidator,
        initialSnapshot,
    }).catch(async (error: unknown) => {
        await repository.releaseSourceLease(lease)
        throw error
    })
    if (result.stale || result.result.status === 'transient_error')
        throw createError({ statusCode: 503, message: 'The provider is temporarily unavailable.' })
    if (result.result.status !== 'available')
        throw serverError.notFound({ responseMessage: 'The provider source is unavailable.' })
    source = (await repository.findSource(source.id)) ?? source
    return finishCatalogResolution(event, db, repository, source)
}
