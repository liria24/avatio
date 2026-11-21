import { CloudflareCacheInvalidator, CloudflareFeatureFlags } from '@avatio/cloudflare'
import type { CacheInvalidator, FileStorage } from '@avatio/core'
import type { ProviderHttpClient } from '@avatio/nuxt/runtime/server/catalog/providers'
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
    new CloudflareFeatureFlags(getRuntimeEnv(event).FLAGS)

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
    }
}

const getRequestCacheContext = (event: H3Event) =>
    (event.context as CloudflareRequestContext).cloudflare?.context?.cache

export const createCacheInvalidator = (cache?: CacheContext): CacheInvalidator =>
    new CloudflareCacheInvalidator(cache)

export const getCacheInvalidator = (event: H3Event): CacheInvalidator =>
    createCacheInvalidator(getRequestCacheContext(event))

export const runAfterResponse = (promise: Promise<unknown>) => {
    try {
        const event = useEvent()

        if (event.waitUntil) {
            event.waitUntil(promise)
            return
        }
    } catch {
        // Not running inside an H3 request context, such as a Cloudflare Queue consumer.
    }

    void promise.catch((error) => {
        logger('waitUntil').error('Background task failed:', error)
    })
}

export const providerHttpClient: ProviderHttpClient = {
    async get<T>(url: string) {
        const response = await $fetch.raw<T | null>(url, { ignoreResponseError: true })
        return {
            status: response.status,
            ok: response.ok,
            data: response._data ?? null,
        }
    },
}
