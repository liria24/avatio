import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import { describe, expect, it } from 'vitest'

import SetupLink from '~/components/setups/link.vue'
import { useSetupsList } from '~/composables/setup'

describe('Setup list image loading', () => {
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
        let failNext = false
        registerEndpoint('/api/setups', {
            method: 'GET',
            handler: (event) => {
                const page = Number(getQuery(event).page)
                requests.push(page)
                if (failNext) {
                    throw new Error('Temporary failure')
                }
                return {
                    data: [{ id: `page-${page}` }],
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
        let list: ReturnType<typeof useSetupsList>
        const wrapper = await mountSuspended(
            defineComponent({
                setup() {
                    list = useSetupsList('latest', {
                        query: { q: 'pagination-check' },
                        immediate: false,
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
        failNext = true
        await list!.loadMore()
        expect(list!.pagination.value?.page).toBe(2)
        failNext = false
        await list!.loadMore()
        expect(list!.setups.value.map((setup) => setup.id)).toEqual(['page-1', 'page-2', 'page-3'])
        expect(new Set(requests)).toEqual(new Set([1, 2, 3]))
        const requestCount = requests.length
        await list!.loadMore()
        expect(requests).toHaveLength(requestCount)
        wrapper.unmount()
    })
})
