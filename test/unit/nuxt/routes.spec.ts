import { deriveReservedRootPaths } from '@avatio/nuxt/build/routes'
import type { NuxtPage } from '@nuxt/schema'

describe('reserved Setup root paths', () => {
    it('derives static first segments and excludes dynamic pages', () => {
        const pages: NuxtPage[] = [
            { path: '/', file: 'index.vue' },
            { path: '/faq', file: 'faq.vue' },
            { path: '/:id()', file: '[id].vue' },
            { path: '/en/privacy-policy', file: 'privacy-policy.vue' },
            {
                path: '/settings',
                file: 'settings.vue',
                children: [{ path: 'profile', file: 'settings/profile.vue' }],
            },
            { path: '/legacy', alias: ['/Alias'], file: 'legacy.vue' },
        ]

        expect(deriveReservedRootPaths(pages, ['ja', 'en'])).toEqual([
            'alias',
            'faq',
            'legacy',
            'privacy-policy',
            'settings',
        ])
    })
})
