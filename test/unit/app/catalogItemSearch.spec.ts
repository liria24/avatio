import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

import { useCatalogItemSearch } from '../../../app/composables/catalogItemSearch'

const item = (id: string): CatalogItemView => ({
    id,
    name: id,
    image: null,
    category: 'other',
    primarySource: null,
    createdAt: '',
    updatedAt: '',
    displayNameOverride: null,
    nsfw: false,
})
const response = (id: string, page = 1, hasNext = false) => ({
    data: [item(id)],
    pagination: { page, limit: 24, total: 48, totalPages: 2, hasNext, hasPrev: page > 1 },
})

describe('catalog search session', () => {
    let scope: EffectScope
    const fetch = vi.fn()
    beforeEach(() => {
        scope = effectScope()
        vi.useFakeTimers()
        fetch.mockReset()
        vi.stubGlobal('$fetch', fetch)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })
    afterEach(() => {
        scope.stop()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('invalidates old results immediately, ignores reversed responses, and pauses for IME', async () => {
        const old = Promise.withResolvers<ReturnType<typeof response>>()
        fetch.mockReturnValueOnce(old.promise).mockResolvedValue(response('new'))
        const search = scope.run(() => useCatalogItemSearch(vi.fn()))!
        search.activate()
        search.searchTerm.value = 'old'
        await vi.advanceTimersByTimeAsync(300)
        search.searchTerm.value = 'new'
        expect(search.results.value).toEqual([])
        await vi.advanceTimersByTimeAsync(300)
        old.resolve(response('old'))
        await vi.advanceTimersByTimeAsync(0)
        expect(search.results.value.map(({ id }) => id)).toEqual(['new'])
        search.composing.value = true
        search.searchTerm.value = '変換中'
        await vi.advanceTimersByTimeAsync(600)
        expect(fetch).toHaveBeenCalledTimes(2)
        search.composing.value = false
        search.queueSearch()
        await vi.advanceTimersByTimeAsync(300)
        expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('retries the failed page without replacing earlier results or mixing queries', async () => {
        fetch
            .mockResolvedValueOnce(response('first', 1, true))
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(response('second', 2))
        const search = scope.run(() => useCatalogItemSearch(vi.fn()))!
        search.activate()
        await vi.advanceTimersByTimeAsync(300)
        await search.fetchResults(2)
        expect(search.failedPage.value).toBe(2)
        expect(search.results.value.map(({ id }) => id)).toEqual(['first'])
        await search.fetchResults(search.failedPage.value)
        expect(search.results.value.map(({ id }) => id)).toEqual(['first', 'second'])
        search.searchTerm.value = 'another'
        expect(search.pagination.value).toBeUndefined()
        expect(search.failedPage.value).toBeUndefined()
    })

    it('resolves only on request with four workers, retries failures, deduplicates, and fences reset responses', async () => {
        const calls: ReturnType<typeof Promise.withResolvers<CatalogItemView>>[] = []
        fetch.mockImplementation(() => {
            const request = Promise.withResolvers<CatalogItemView>()
            calls.push(request)
            return request.promise
        })
        const selected = ref<string[]>([])
        const select = vi.fn((result: CatalogItemView) => {
            selected.value.push(result.id)
        })
        const search = scope.run(() => useCatalogItemSearch(select, { selectedIds: selected }))!
        search.searchTerm.value = Array.from(
            { length: 6 },
            (_, i) => `https://example.com/${i}`,
        ).join(' ')
        expect(fetch).not.toHaveBeenCalled()
        search.resolveUrls()
        expect(fetch).toHaveBeenCalledTimes(4)
        calls[0]!.resolve(item('same'))
        calls[1]!.resolve(item('same'))
        calls[2]!.reject(new Error('temporary failure'))
        await vi.advanceTimersByTimeAsync(0)
        expect(fetch).toHaveBeenCalledTimes(6)
        expect(search.jobs.value.slice(0, 3).map(({ status }) => status)).toEqual([
            'added',
            'duplicate',
            'failed',
        ])
        search.retryJob(search.jobs.value[2]!.id)
        expect(fetch).toHaveBeenCalledTimes(7)
        calls[6]!.resolve(item('retry'))
        await vi.advanceTimersByTimeAsync(0)
        expect(selected.value).toEqual(['same', 'retry'])
        search.reset()
        for (const call of calls) call.resolve(item('late'))
        await vi.advanceTimersByTimeAsync(0)
        expect(search.jobs.value).toEqual([])
        expect(select).toHaveBeenCalledTimes(2)
    })
})
