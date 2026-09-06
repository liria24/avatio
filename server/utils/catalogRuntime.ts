import {
    CloudflareCacheInvalidator,
    CloudflareCatalogSyncQueue,
    D1CatalogRepository,
} from '@avatio/cloudflare'
import {
    CatalogProviderRegistry,
    enqueueDueCatalogSources,
    type CatalogSyncQueue,
} from '@avatio/core/catalog'
import {
    BoothCatalogProvider,
    GithubCatalogProvider,
} from '@avatio/nuxt/runtime/server/catalog/providers'
import type { CacheContext, Queue } from '@cloudflare/workers-types'
import { allowedBoothCategories } from '~~/database/schema'

export const getCatalogRepository = () => new D1CatalogRepository(getDatabaseBinding())

export const getCatalogProviderRegistry = async () => {
    const db = useDB()
    const admittedCategories = await db.select().from(allowedBoothCategories)
    const proxyBaseUrl = getRuntimeEnvString('BOOTH_PROXY_URL')
    if (!proxyBaseUrl) throw new Error('Missing required BOOTH_PROXY_URL runtime secret.')
    const publisherRepository = getPublisherRepository()
    const resolvePublisherSource = async (
        snapshot: Parameters<typeof publisherRepository.upsertSource>[0],
    ) => (await publisherRepository.upsertSource(snapshot)).id

    return new CatalogProviderRegistry([
        new BoothCatalogProvider({
            proxyBaseUrl,
            allowedCategoryKeys: new Set(
                admittedCategories.map(({ categoryId }) => String(categoryId)),
            ),
            categoryMap: Object.fromEntries(
                Object.entries(BOOTH_CATEGORY_MAP).map(([key, category]) => [key, category]),
            ),
            http: providerHttpClient,
            resolvePublisherSource,
        }),
        new GithubCatalogProvider({ http: providerHttpClient, resolvePublisherSource }),
    ])
}

export const getCatalogSyncQueue = (): CatalogSyncQueue | null => {
    const queue = getRuntimeEnv().ITEM_REVALIDATION_QUEUE as Queue | undefined
    return queue ? new CloudflareCatalogSyncQueue(queue) : null
}

export const getCatalogCacheInvalidator = (cache?: CacheContext) =>
    new CloudflareCacheInvalidator(cache)

export const enqueueReferencedCatalogSources = async (
    references: readonly { id: string; platform: Platform }[],
) => {
    const queue = getCatalogSyncQueue()
    if (!queue) return null

    const repository = getCatalogRepository()
    const sources = await Promise.all(
        references.map(({ id, platform }) => repository.findSourceByExternalId(platform, id)),
    )
    return enqueueDueCatalogSources({
        sourceIds: sources.flatMap((source) => (source ? [source.id] : [])),
        repository,
        queue,
    })
}
