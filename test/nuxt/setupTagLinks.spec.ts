import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import SetupInfo from '~/components/setups/viewer/info.vue'

mockNuxtImport('useUserSession', () => () => ({ user: ref(null) }))
mockNuxtImport('useSetupDeleteModal', () => () => ({ open: () => undefined }))

describe('Setup tag links', () => {
    it.each(['/', '/en'])(
        'round-trips punctuation and renders tags as text on %s',
        async (route) => {
            const tags = ['a+b', 'a#b', 'a&b', 'a/b', '日本語 &amp; +/#', '<b>literal</b>']
            const wrapper = await mountSuspended(SetupInfo, {
                route,
                props: {
                    setup: {
                        id: 'setup',
                        public: true,
                        name: 'Setup',
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-01T00:00:00Z',
                        user: { id: 'user', name: 'User', username: 'user', image: null },
                        entries: [],
                        tags,
                    },
                },
                global: { stubs: { UUser: true, NuxtTime: true } },
            })
            const links = wrapper
                .findAll('a')
                .filter((link) => link.attributes('href')?.includes('/search?'))
            expect(links).toHaveLength(tags.length)
            for (const [index, link] of links.entries()) {
                const url = new URL(link.attributes('href')!, 'https://example.test')
                expect(url.searchParams.get('tag')).toBe(tags[index])
                expect([...url.searchParams.keys()]).toEqual(['tag'])
                expect(url.hash).toBe('')
                expect(link.text()).toBe(tags[index])
                expect(link.find('b').exists()).toBe(false)
            }
            wrapper.unmount()
        },
    )
})
