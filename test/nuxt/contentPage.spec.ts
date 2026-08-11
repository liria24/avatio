import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'

import ContentPage from '~/pages/[slug].vue'

const { ogImageMock } = vi.hoisted(() => ({ ogImageMock: vi.fn() }))

mockNuxtImport('useRoute', () => () => ({
    fullPath: '/missing',
    matched: [],
    meta: {},
    params: { slug: 'missing' },
    path: '/missing',
    query: {},
}))
mockNuxtImport(
    'useContentPage',
    () => () => Promise.resolve({ data: ref({ content: null, isFallback: false }) }),
)
mockNuxtImport('useOgImage', () => ogImageMock)

describe('content page', () => {
    it('throws before generating an OG image when content is missing', async () => {
        await expect(mountSuspended(ContentPage)).rejects.toMatchObject({ statusCode: 404 })
        expect(ogImageMock).not.toHaveBeenCalled()
    })
})
