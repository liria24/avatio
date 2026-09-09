import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SetupImage from '~/components/setups/image.vue'
import SetupLink from '~/components/setups/link.vue'
import SetupList from '~/components/setups/list.vue'
import { useSetupsList } from '~/composables/setup'
import { useSetupEntrance } from '~/composables/setupEntrance'

describe('Setup list image loading', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })
    it('opts in explicitly, shares one observer, and consumes entry before animationend or remount', async () => {
        const observe = vi.fn()
        const disconnect = vi.fn()
        const construct = vi.fn()
        let intersect: (entries: { target: Element; isIntersecting: boolean }[]) => void
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback: typeof intersect) {
                    construct()
                    intersect = callback
                }
                observe = observe
                unobserve = vi.fn()
                disconnect = disconnect
            },
        )
        const entrance = useSetupEntrance()
        const pending = entrance.display('latest', true, [])
        entrance.append('latest', ['a', 'b'])
        const options = {
            props: {
                setups: [{ id: 'a' }, { id: 'b' }] as ReturnType<
                    typeof useSetupsList
                >['setups']['value'],
                entrance: pending,
            },
            global: {
                stubs: {
                    MasonryWall: {
                        props: ['items'],
                        template:
                            '<div><slot v-for="(item, index) in items" :item="item" :index="index" /></div>',
                    },
                    SetupsLink: { template: '<a href="#">Setup</a>' },
                },
            },
        }
        const wrapper = await mountSuspended(SetupList, options)
        expect(construct).toHaveBeenCalledTimes(1)
        expect(observe).toHaveBeenCalledTimes(2)
        const waiting = wrapper.findAll('.setup-card-waiting')
        expect(waiting).toHaveLength(2)
        intersect!([{ target: waiting[0]!.element, isIntersecting: true }])
        expect(pending.has('a')).toBe(false)
        await waiting[1]!.trigger('focusin')
        expect(pending.size).toBe(0)
        expect(disconnect).toHaveBeenCalled()
        wrapper.unmount()
        const remount = await mountSuspended(SetupList, options)
        expect(remount.find('.setup-card-enter').exists()).toBe(false)
        expect(remount.find('.setup-card-waiting').exists()).toBe(false)
        remount.unmount()
        const ordinary = await mountSuspended(SetupList, {
            ...options,
            props: { setups: options.props.setups },
        })
        expect(ordinary.find('.setup-card-enter').exists()).toBe(false)
        ordinary.unmount()
    })
    it('reveals independently, finishes without animationend, and ignores detached image events', async () => {
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
        const wrapper = await mountSuspended(SetupImage, {
            props: { src: '/pending.png' },
            attrs: { width: 1200, height: 800 },
        })
        const old = wrapper.find('img').element
        Object.defineProperties(old, {
            complete: { configurable: true, value: true },
            naturalWidth: { configurable: true, value: 1200 },
        })
        vi.useFakeTimers()
        await wrapper.find('img').trigger('load')
        expect(wrapper.attributes('data-state')).toBe('revealing')
        await vi.advanceTimersByTimeAsync(200)
        expect(wrapper.attributes('data-state')).toBe('ready')
        expect(wrapper.find('.setup-skeleton').exists()).toBe(false)
        await wrapper.setProps({ src: '/other.png' })
        expect(wrapper.attributes('data-state')).toBe('loading')
        old.dispatchEvent(new Event('error'))
        await nextTick()
        expect(wrapper.attributes('data-state')).toBe('loading')
        await wrapper.find('img').trigger('error')
        expect(wrapper.attributes('data-state')).toBe('error')
        expect(wrapper.find('.setup-skeleton').exists()).toBe(false)
        expect(wrapper.find('img').attributes('height')).toBe('800')
        wrapper.unmount()
        vi.useRealTimers()
    })

    it('does not hide already decoded images on mount and handles missing sources', async () => {
        const complete = vi
            .spyOn(HTMLImageElement.prototype, 'complete', 'get')
            .mockReturnValue(true)
        const width = vi
            .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
            .mockReturnValue(1200)
        const wrapper = await mountSuspended(SetupImage, { props: { src: '/cached.png' } })
        expect(wrapper.attributes('data-state')).toBe('ready')
        await wrapper.setProps({ src: undefined })
        expect(wrapper.attributes('data-state')).toBe('error')
        wrapper.unmount()
        complete.mockRestore()
        width.mockRestore()
    })
    it('renders the real image with intrinsic dimensions and only prioritizes the first cards', async () => {
        const setup: ReturnType<typeof useSetupsList>['setups']['value'][number] = {
            id: 'image-test',
            name: 'Image test',
            createdAt: '2026-09-08T00:00:00Z',
            updatedAt: '2026-09-08T00:00:00Z',
            public: true,
            hidAt: null,
            user: { username: 'tester', name: 'Tester', image: null, badges: [] },
            entries: [],
            coauthors: [],
            failedItemsCount: undefined,
            images: [
                {
                    url: '/image-test.png',
                    objectKey: 'image-test.png',
                    width: 1200,
                    height: 800,
                    themeColors: ['#123456'],
                },
            ],
        }
        const wrapper = await mountSuspended(SetupLink, {
            props: { setup, index: 0 },
            global: {
                stubs: {
                    PopoverUser: true,
                    NuxtTime: true,
                    UAvatar: true,
                    UTooltip: { template: '<span><slot /></span>' },
                },
            },
        })
        const image = wrapper.find('img')
        expect(image.attributes()).toMatchObject({
            width: '1200',
            height: '800',
            loading: 'eager',
            fetchpriority: 'high',
        })
        expect(image.attributes('src')).toContain('image-test.png')
        expect(image.attributes('srcset')).toContain('image-test.png')
        expect(image.attributes('src')).not.toMatch(/^data:/)
        await wrapper.setProps({ index: 2 })
        expect(image.attributes('loading')).toBe('lazy')
        expect(image.attributes('fetchpriority')).toBeUndefined()
        wrapper.unmount()
    })

    it('appends each page once and retries a failed page without skipping it', async () => {
        const requests: number[] = []
        const appended: string[][] = []
        const staleStarted = Promise.withResolvers<void>()
        const releaseStale = Promise.withResolvers<void>()
        let failNext = false
        registerEndpoint('/api/setups', {
            method: 'GET',
            handler: async (event) => {
                const { page: pageValue, q: queryValue } = getQuery(event)
                const page = Number(pageValue)
                const q = typeof queryValue === 'string' ? queryValue : ''
                requests.push(page)
                if (failNext) {
                    throw new Error('Temporary failure')
                }
                if (q === 'stale' && page === 2) {
                    staleStarted.resolve()
                    await releaseStale.promise
                }
                return {
                    data: [{ id: `${q === 'pagination-check' ? '' : `${q}-`}page-${page}` }],
                    pagination: {
                        page,
                        limit: 24,
                        total: 72,
                        totalPages: 3,
                        hasNext: page < 3,
                        hasPrev: page > 1,
                    },
                }
            },
        })
        const listQuery = ref({ q: 'pagination-check' })
        let list: ReturnType<typeof useSetupsList>
        const wrapper = await mountSuspended(
            defineComponent({
                setup() {
                    list = useSetupsList('latest', {
                        query: listQuery,
                        immediate: false,
                        watch: false,
                        onAppend: (ids) => appended.push(ids),
                    })
                    return () => h('div')
                },
            }),
        )
        await list!.refresh()
        expect(list!.pagination.value?.limit).toBe(24)
        await Promise.all([list!.loadMore(), list!.loadMore()])
        expect(list!.setups.value.map((setup) => setup.id)).toEqual(['page-1', 'page-2'])
        expect(requests).toEqual([1, 2])
        expect(appended).toEqual([['page-2']])
        failNext = true
        await list!.loadMore()
        expect(list!.pagination.value?.page).toBe(2)
        expect(appended).toEqual([['page-2']])
        failNext = false
        await list!.loadMore()
        expect(list!.setups.value.map((setup) => setup.id)).toEqual(['page-1', 'page-2', 'page-3'])
        expect(new Set(requests)).toEqual(new Set([1, 2, 3]))
        const requestCount = requests.length
        await list!.loadMore()
        expect(requests).toHaveLength(requestCount)
        await list!.refresh()
        expect(appended).toEqual([['page-2'], ['page-3']])

        listQuery.value = { q: 'stale' }
        await list!.refresh()
        const stalePage = list!.loadMore()
        await staleStarted.promise
        listQuery.value = { q: 'fresh' }
        await list!.refresh()
        expect(list!.status.value).toBe('success')
        releaseStale.resolve()
        await stalePage
        expect(list!.setups.value.map((setup) => setup.id)).toEqual(['fresh-page-1'])
        wrapper.unmount()
    })
})
