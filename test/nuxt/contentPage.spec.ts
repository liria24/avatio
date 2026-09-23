import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'

import ContentPage from '~/components/content/pageRenderer.vue'

const { ogImageMock } = vi.hoisted(() => ({ ogImageMock: vi.fn() }))

mockNuxtImport(
    'useAvatioContent',
    () => () => Promise.resolve({ data: ref(null), error: ref(null) }),
)
mockNuxtImport('useOgImage', () => ogImageMock)

describe('content page', () => {
    it('throws before generating an OG image when content is missing', async () => {
        await expect(
            mountSuspended(ContentPage, { props: { slug: 'missing' } }),
        ).rejects.toMatchObject({ statusCode: 404 })
        expect(ogImageMock).not.toHaveBeenCalled()
    })
})
