import {
    CloudflareCacheInvalidator,
    CloudflareCatalogSyncQueue,
    SQLiteCatalogRepository,
} from '@avatio/cloudflare'
import {
    CatalogProviderRegistry,
    enqueueDueCatalogSources,
    syncCatalogSource,
    type CatalogSyncQueue,
} from '@avatio/core/catalog'
import {
    BoothCatalogProvider,
    GithubCatalogProvider,
} from '@avatio/nuxt/runtime/server/catalog/providers'
import type { CacheContext, Queue } from '@cloudflare/workers-types'
import { inArray } from 'drizzle-orm'
import { allowedBoothCategories, itemSources } from '~~/database/schema'

export const getCatalogRepository = () => {
    const db = useDB()
    return new SQLiteCatalogRepository(db, (queries) => executeAppBatch(db, queries))
}

export const getCatalogProviderRegistry = async () => {
    const db = useDB()
    const admittedCategories = await db.select().from(allowedBoothCategories)
    const proxyBaseUrl = getRuntimeEnvString('BOOTH_PROXY_URL')
    const publisherRepository = getPublisherRepository()
    const resolvePublisherSource = async (
        snapshot: Parameters<typeof publisherRepository.upsertSource>[0],
    ) => (await publisherRepository.upsertSource(snapshot)).id

    return new CatalogProviderRegistry([
        ...(proxyBaseUrl
            ? [
                  new BoothCatalogProvider({
                      proxyBaseUrl,
                      allowedCategoryKeys: new Set(
                          admittedCategories.map(({ categoryId }) => String(categoryId)),
                      ),
                      categoryMap: BOOTH_CATEGORY_MAP,
                      http: providerHttpClient,
                      resolvePublisherSource,
                  }),
              ]
            : []),
        new GithubCatalogProvider({ http: providerHttpClient, resolvePublisherSource }),
    ])
}

export const getCatalogSyncQueue = (): CatalogSyncQueue | null => {
    if (import.meta.dev)
        return {
            async enqueue(message) {
                await syncCatalogSource({
                    sourceId: message.sourceId,
                    leaseToken: message.leaseToken,
                    repository: getCatalogRepository(),
                    providers: await getCatalogProviderRegistry(),
                    cacheInvalidator: getCatalogCacheInvalidator(),
                })
            },
        }
    const queue = getRuntimeEnv().ITEM_REVALIDATION_QUEUE as Queue | undefined
    return queue ? new CloudflareCatalogSyncQueue(queue) : null
}

export const getCatalogCacheInvalidator = (cache?: CacheContext) =>
    new CloudflareCacheInvalidator(cache)

export const enqueueReferencedCatalogSources = async (catalogItemIds: readonly string[]) => {
    const queue = getCatalogSyncQueue()
    if (!queue || !catalogItemIds.length) return null

    const repository = getCatalogRepository()
    const sources = await useDB()
        .select({ id: itemSources.id })
        .from(itemSources)
        .where(inArray(itemSources.itemId, [...catalogItemIds]))
    return enqueueDueCatalogSources({
        sourceIds: sources.map((source) => source.id),
        repository,
        queue,
    })
}
