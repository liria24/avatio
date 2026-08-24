import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.stubGlobal('logger', () => ({ error: vi.fn() }))
})

afterEach(() => {
    vi.doUnmock('../../../server/utils/waitUntil')
    vi.resetModules()
    vi.unstubAllGlobals()
})

describe('edge cache policy', () => {
    it('marks anonymous public documents as edge-cacheable and varies on cookies', async () => {
        const { EDGE_CACHE_CONTROL, getDocumentCacheHeaders } =
            await import('../../../server/utils/edgeCache')

        expect(getDocumentCacheHeaders('/en/setup/Abc_123-', 200)).toEqual({
            'Cache-Control': 'public, max-age=60',
            'Cloudflare-CDN-Cache-Control': EDGE_CACHE_CONTROL,
            'Cache-Tag': 'setup:Abc_123-',
            Vary: 'Cookie',
        })
    })

    it('only treats exact Better Auth session cookies as private', async () => {
        const { NO_STORE_CACHE_CONTROL, getDocumentCacheHeaders } =
            await import('../../../server/utils/edgeCache')

        for (const cookie of [
            'better-auth.session_token=token',
            '__Secure-better-auth.session_token=token',
            'better-auth-session-token=token',
        ])
            expect(getDocumentCacheHeaders('/@alice', 200, cookie)).toEqual({
                'Cache-Control': NO_STORE_CACHE_CONTROL,
            })

        for (const cookie of [
            'i18n_redirected=ja',
            'theme=dark; better-auth.session_token-extra=token',
            'unrelated-better-auth=value',
        ])
            expect(getDocumentCacheHeaders('/@alice', 200, cookie)).toMatchObject({
                'Cloudflare-CDN-Cache-Control': expect.stringContaining('public'),
                Vary: 'Cookie',
            })
    })

    it('does not cache private routes or error documents', async () => {
        const { NO_STORE_CACHE_CONTROL, getDocumentCacheHeaders } =
            await import('../../../server/utils/edgeCache')

        expect(getDocumentCacheHeaders('/settings', 200)).toEqual({
            'Cache-Control': NO_STORE_CACHE_CONTROL,
        })
        expect(getDocumentCacheHeaders('/setup/Abc_123-', 404)).toEqual({
            'Cache-Control': NO_STORE_CACHE_CONTROL,
        })
    })

    it('assigns aggregate tags to public collection pages', async () => {
        const { EDGE_CACHE_TAGS, getPublicDocumentCacheTags } =
            await import('../../../server/utils/edgeCache')

        expect(getPublicDocumentCacheTags('/')).toEqual([
            EDGE_CACHE_TAGS.changelogs,
            EDGE_CACHE_TAGS.setups,
        ])
        expect(getPublicDocumentCacheTags('/ja/search')).toEqual([
            EDGE_CACHE_TAGS.popularAvatars,
            EDGE_CACHE_TAGS.setups,
        ])
        expect(getPublicDocumentCacheTags('/setup/compose')).toBeUndefined()
    })

    it('drops invalid cache tags before emitting response headers', async () => {
        const { getPublicEdgeCacheHeaders } = await import('../../../server/utils/edgeCache')

        expect(getPublicEdgeCacheHeaders(['setups', '日本語', 'setup:abc'])).toMatchObject({
            'Cache-Tag': 'setups,setup:abc',
        })
    })

    it('uses a short presentation TTL and supports CatalogItem resource tags', async () => {
        const { EDGE_CACHE_CONTROL, getCatalogItemCacheTag, getPublicEdgeCacheHeaders } =
            await import('../../../server/utils/edgeCache')

        expect(EDGE_CACHE_CONTROL).toContain('max-age=900')
        expect(
            getPublicEdgeCacheHeaders(['setup:AbCd1234', getCatalogItemCacheTag('item-1')]),
        ).toMatchObject({
            'Cache-Control': 'public, max-age=60',
            'Cache-Tag': 'setup:AbCd1234,item:item-1',
        })
    })
})

describe('edge cache purge', () => {
    it('purges the deduplicated tag set through the Cloudflare cache context', async () => {
        const { invalidateCacheResourcesWithContext } =
            await import('../../../server/utils/edgeCache')
        const purge = vi.fn().mockResolvedValue({ success: true, errors: [] })

        await invalidateCacheResourcesWithContext(
            { purge },
            { collections: ['setups', 'setups'], setups: ['abc'] },
            'test',
        )

        expect(purge).toHaveBeenCalledWith({ tags: ['setup:abc', 'setups'] })
    })

    it('retries a failed request purge after the response', async () => {
        vi.doMock('../../../server/utils/waitUntil', () => ({
            runAfterResponse: (promise: Promise<unknown>) => void promise,
        }))
        const { invalidateCacheResources } = await import('../../../server/utils/edgeCache')
        const invalidate = vi
            .fn()
            .mockRejectedValueOnce(new Error('temporary cache failure'))
            .mockResolvedValue(undefined)
        const purge = vi.fn(() =>
            invalidate({ collections: ['setups'] }).then(() => ({
                success: true,
                errors: [],
            })),
        )

        await invalidateCacheResources(
            { context: { cloudflare: { context: { cache: { purge } } } } } as never,
            { collections: ['setups'] },
            'test retry',
        )

        await vi.waitFor(() => expect(purge).toHaveBeenCalledTimes(2))
    })
})
