import type { CacheInvalidationInput, CacheInvalidator } from '@avatio/core'
import type { CacheContext } from '@cloudflare/workers-types'
import { eq, or } from 'drizzle-orm'
import { setResponseHeader, setResponseHeaders } from 'h3'
import type { H3Event } from 'h3'
import { setupCoauthors, setups } from '~~/database/schema'

const log = logger('edgeCache')

export const EDGE_CACHE_TAGS = {
    changelogs: 'changelogs',
    items: 'items',
    popularAvatars: 'popular-avatars',
    setups: 'setups',
    users: 'users',
} as const

export const EDGE_CACHE_BROWSER_CONTROL = 'public, max-age=60'
export const EDGE_CACHE_CONTROL =
    'public, max-age=900, stale-while-revalidate=3600, stale-if-error=3600'
export const NO_STORE_CACHE_CONTROL = 'private, no-store'

const EDGE_CACHE_TAG_PATTERN = /^[\x21-\x7e]+$/
const MAX_TAG_LENGTH = 1024

const normalizeTags = (tags: Iterable<string>) =>
    [...new Set(tags)].filter(
        (tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH && EDGE_CACHE_TAG_PATTERN.test(tag),
    )

const appendVaryHeader = (headers: Record<string, string>, value: string) => {
    const existingKey = Object.keys(headers).find((key) => key.toLowerCase() === 'vary')
    const existing = existingKey ? headers[existingKey] : undefined
    const values = new Set(
        `${existing || ''},${value}`
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
    )

    headers[existingKey || 'Vary'] = [...values].join(', ')
}

export const getSetupCacheTag = (id: Setup['id']) => `setup:${id}`
export const getCatalogItemCacheTag = (id: string) => `item:${id}`

const getNormalizedPathname = (pathname: string) => {
    const normalized = pathname.replace(/^\/(?:en|ja)(?=\/|$)/, '')
    return normalized || '/'
}

export const getPublicDocumentCacheTags = (pathname: string) => {
    const path = getNormalizedPathname(pathname)

    if (path === '/') return [EDGE_CACHE_TAGS.changelogs, EDGE_CACHE_TAGS.setups]
    if (path === '/search') return [EDGE_CACHE_TAGS.popularAvatars, EDGE_CACHE_TAGS.setups]
    if (path === '/changelogs') return [EDGE_CACHE_TAGS.changelogs]
    if (/^\/@[^/]+$/.test(path)) return [EDGE_CACHE_TAGS.setups, EDGE_CACHE_TAGS.users]

    const setup = path.match(/^\/setup\/([^/]+)$/)
    if (setup?.[1] && setup[1] !== 'compose') return [getSetupCacheTag(setup[1])]
}

export const getPublicEdgeCacheHeaders = (tags: Iterable<string>, varyCookie = false) => {
    const normalizedTags = normalizeTags(tags)
    const headers: Record<string, string> = {
        'Cache-Control': EDGE_CACHE_BROWSER_CONTROL,
        'Cloudflare-CDN-Cache-Control': EDGE_CACHE_CONTROL,
    }

    if (normalizedTags.length) headers['Cache-Tag'] = normalizedTags.join(',')
    if (varyCookie) appendVaryHeader(headers, 'Cookie')

    return headers
}

export const getDocumentCacheHeaders = (
    pathname: string,
    statusCode: number,
    cookieHeader?: string | null,
) => {
    const tags = getPublicDocumentCacheTags(pathname)
    if (statusCode !== 200 || !tags || hasBetterAuthSessionCookie(cookieHeader))
        return { 'Cache-Control': NO_STORE_CACHE_CONTROL }

    return getPublicEdgeCacheHeaders(tags, true)
}

export const applyPublicEdgeCache = (
    event: H3Event,
    tags: Iterable<string>,
    varyCookie = false,
) => {
    setResponseHeaders(event, getPublicEdgeCacheHeaders(tags, varyCookie))
}

export const applyNoStoreCache = (event: H3Event) => {
    setResponseHeader(event, 'Cache-Control', NO_STORE_CACHE_CONTROL)
}

const retryInvalidation = async (
    invalidator: CacheInvalidator,
    input: CacheInvalidationInput,
    operation: string,
) => {
    for (let attempt = 1; attempt <= 2; attempt++)
        try {
            await invalidator.invalidate(input)
            return
        } catch (error) {
            log.error(`Retry ${attempt} failed for ${operation}:`, error)
        }
}

export const invalidateCacheResources = async (
    event: H3Event,
    input: CacheInvalidationInput,
    operation: string,
) => {
    const invalidator = getCacheInvalidator(event)

    try {
        await invalidator.invalidate(input)
    } catch (error) {
        log.error(`Failed to invalidate cache for ${operation}:`, error)
        runAfterResponse(retryInvalidation(invalidator, input, operation))
    }
}

export const invalidateCacheResourcesWithContext = async (
    cache: CacheContext,
    input: CacheInvalidationInput,
    operation: string,
) => {
    try {
        await createCacheInvalidator(cache).invalidate(input)
    } catch (error) {
        log.error(`Failed to invalidate cache for ${operation}:`, error)
        throw error
    }
}

export const getUserContentCacheResources = async (
    db: ReturnType<typeof useDB>,
    userId: string,
): Promise<CacheInvalidationInput> => {
    const relatedSetups = await db
        .select({ id: setups.id })
        .from(setups)
        .leftJoin(setupCoauthors, eq(setupCoauthors.setupId, setups.id))
        .where(or(eq(setups.userId, userId), eq(setupCoauthors.userId, userId)))

    return {
        users: [userId],
        setups: relatedSetups.map((setup) => setup.id),
        collections: [EDGE_CACHE_TAGS.changelogs, EDGE_CACHE_TAGS.setups, EDGE_CACHE_TAGS.users],
    }
}

export const invalidateUserContentCache = async (
    event: H3Event,
    db: ReturnType<typeof useDB>,
    userId: string,
    operation: string,
    options?: { includePopularAvatars?: boolean },
) => {
    const resources = await getUserContentCacheResources(db, userId)
    if (options?.includePopularAvatars)
        resources.collections = [...(resources.collections ?? []), EDGE_CACHE_TAGS.popularAvatars]
    await invalidateCacheResources(event, resources, operation)
}
