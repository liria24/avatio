import {
    CloudflareCacheInvalidator,
    CloudflareFeatureFlags,
    R2FileStorage,
} from '@avatio/cloudflare'
import type { CacheInvalidator, FileStorage } from '@avatio/core'
import type { CacheContext, R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'

type CloudflareRequestContext = {
    cloudflare?: {
        context?: {
            cache?: CacheContext
        }
    }
}

export const getFeatureFlags = (event?: H3Event) =>
    new CloudflareFeatureFlags(getRuntimeEnv(event).FLAGS)

export const getFileStorage = (event?: H3Event): FileStorage => {
    const env = getRuntimeEnv(event)
    const bucket = env.R2 as R2Bucket | undefined
    const publicBaseUrl = getRuntimeEnvString('R2_PUBLIC_BASE_URL', event)
    if (!bucket) throw new Error('Missing required Cloudflare R2 binding: R2')
    if (!publicBaseUrl) throw new Error('Missing required R2_PUBLIC_BASE_URL runtime setting.')
    return new R2FileStorage({ bucket, publicBaseUrl })
}

export const getRequestCacheContext = (event: H3Event) =>
    (event.context as CloudflareRequestContext).cloudflare?.context?.cache

export const createCacheInvalidator = (cache?: CacheContext): CacheInvalidator =>
    new CloudflareCacheInvalidator(cache)

export const getCacheInvalidator = (event: H3Event): CacheInvalidator =>
    createCacheInvalidator(getRequestCacheContext(event))
