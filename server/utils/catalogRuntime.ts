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
    type ProviderHttpClient,
} from '@avatio/nuxt/runtime/server/catalog/providers'
import type { CacheContext, Queue } from '@cloudflare/workers-types'

import { allowedBoothCategories } from '../../database/schema'
import { BOOTH_CATEGORY_MAP } from '../../shared/utils/constants'
import { getDatabaseBinding, useDB } from './database'

const catalogHttpClient: ProviderHttpClient = {
    async get<T>(url: string) {
        const response = await $fetch.raw<T | null>(url, { ignoreResponseError: true })
        return {
            status: response.status,
            ok: response.ok,
            data: response._data ?? null,
        }
    },
}

export const getCatalogRepository = () => new D1CatalogRepository(getDatabaseBinding())

export const getCatalogProviderRegistry = async () => {
    const db = useDB()
    const admittedCategories = await db.select().from(allowedBoothCategories)
    const proxyBaseUrl = getRuntimeEnvString('BOOTH_PROXY_URL')
    if (!proxyBaseUrl) throw new Error('Missing required BOOTH_PROXY_URL runtime secret.')

    return new CatalogProviderRegistry([
        new BoothCatalogProvider({
            proxyBaseUrl,
            allowedCategoryKeys: new Set(
                admittedCategories.map(({ categoryId }) => String(categoryId)),
            ),
            categoryMap: Object.fromEntries(
                Object.entries(BOOTH_CATEGORY_MAP).map(([key, category]) => [key, category]),
            ),
            http: catalogHttpClient,
        }),
        new GithubCatalogProvider({ http: catalogHttpClient }),
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
