import type { CacheContext } from '@cloudflare/workers-types'
import { eq, or } from 'drizzle-orm'
import { setResponseHeader, setResponseHeaders } from 'h3'
import type { H3Event } from 'h3'

import { setupCoauthors, setups } from '../../database/schema'
import { hasBetterAuthSessionCookie } from '../../shared/utils/authCookie'
import { runAfterResponse } from './waitUntil'

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
    'public, max-age=86400, stale-while-revalidate=3600, stale-if-error=3600'
export const NO_STORE_CACHE_CONTROL = 'private, no-store'

const EDGE_CACHE_TAG_PATTERN = /^[\x21-\x7e]+$/
const MAX_TAG_LENGTH = 1024

type CloudflareEventContext = {
    cloudflare?: {
        context?: {
            cache?: CacheContext
        }
    }
}

const getCacheContext = (event: H3Event) =>
    (event.context as CloudflareEventContext).cloudflare?.context?.cache

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

const purgeWithContext = async (cache: CacheContext, tags: readonly string[]) => {
    const result = await cache.purge({ tags: [...tags] })
    if (!result.success)
        throw new Error(
            `Cache tag purge failed: ${result.errors.map((error) => error.message).join(', ')}`,
        )
}

const retryPurge = async (cache: CacheContext, tags: readonly string[], operation: string) => {
    for (let attempt = 1; attempt <= 2; attempt++)
        try {
            await purgeWithContext(cache, tags)
            return
        } catch (error) {
            log.error(`Retry ${attempt} failed for ${operation}:`, error)
        }
}

export const purgeEdgeCacheTags = async (
    event: H3Event,
    tags: Iterable<string>,
    operation: string,
) => {
    const normalizedTags = normalizeTags(tags)
    if (!normalizedTags.length) return

    const cache = getCacheContext(event)
    if (!cache) return

    try {
        await purgeWithContext(cache, normalizedTags)
    } catch (error) {
        log.error(`Failed to purge cache for ${operation}:`, error)
        runAfterResponse(retryPurge(cache, normalizedTags, operation))
    }
}

export const purgeEdgeCacheTagsWithContext = async (
    cache: CacheContext,
    tags: Iterable<string>,
    operation: string,
) => {
    const normalizedTags = normalizeTags(tags)
    if (!normalizedTags.length) return

    try {
        await purgeWithContext(cache, normalizedTags)
    } catch (error) {
        log.error(`Failed to purge cache for ${operation}:`, error)
        throw error
    }
}

export const getUserContentCacheTags = async (db: ReturnType<typeof useDB>, userId: string) => {
    const relatedSetups = await db
        .select({ id: setups.id })
        .from(setups)
        .leftJoin(setupCoauthors, eq(setupCoauthors.setupId, setups.id))
        .where(or(eq(setups.userId, userId), eq(setupCoauthors.userId, userId)))

    return normalizeTags([
        EDGE_CACHE_TAGS.changelogs,
        EDGE_CACHE_TAGS.setups,
        EDGE_CACHE_TAGS.users,
        ...relatedSetups.map((setup) => getSetupCacheTag(setup.id)),
    ])
}

export const purgeUserContentCache = async (
    event: H3Event,
    db: ReturnType<typeof useDB>,
    userId: string,
    operation: string,
    options?: { includePopularAvatars?: boolean },
) => {
    const tags = await getUserContentCacheTags(db, userId)
    if (options?.includePopularAvatars) tags.push(EDGE_CACHE_TAGS.popularAvatars)
    await purgeEdgeCacheTags(event, tags, operation)
}
