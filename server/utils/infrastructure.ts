import { CloudflareCacheInvalidator, CloudflareFeatureFlags } from '@avatio/cloudflare'
import type { CacheInvalidator, FileStorage } from '@avatio/core'
import type { CacheContext } from '@cloudflare/workers-types'
import type { H3Event } from '@nuxt/nitro-server/h3'

type CloudflareRequestContext = {
    cloudflare?: {
        context?: {
            cache?: CacheContext
        }
    }
}

export const getFeatureFlags = (event?: H3Event) =>
    import.meta.dev
        ? { isEnabled: async () => false }
        : new CloudflareFeatureFlags(getRuntimeEnv(event).FLAGS)

export const getFileStorage = (): FileStorage => {
    const files = useServerFiles()
    return {
        async importFromUrl({ sourceUrl, destinationKey }) {
            const response = await fetch(sourceUrl)
            if (!response.ok) throw new Error(`File import failed with status ${response.status}.`)
            await files.upload(destinationKey, await response.blob(), {
                contentType: response.headers.get('content-type') ?? undefined,
            })
            return { key: destinationKey, url: await files.url(destinationKey) }
        },
        async delete(key) {
            await files.delete(key)
        },
    }
}

export const getRequestCacheContext = (event: H3Event) =>
    (event.context as CloudflareRequestContext).cloudflare?.context?.cache

export const createCacheInvalidator = (cache?: CacheContext): CacheInvalidator =>
    new CloudflareCacheInvalidator(cache)

export const getCacheInvalidator = (event: H3Event): CacheInvalidator =>
    createCacheInvalidator(getRequestCacheContext(event))
