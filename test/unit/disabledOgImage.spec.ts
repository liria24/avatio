import { useDisabledOgImage } from '../../config/runtime/disabledOgImage'

it('omits Preview OG imagery without performing any fetch', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('$fetch', fetch)
    try {
        await expect(
            useDisabledOgImage({ title: 'Preview', description: 'Synthetic' }),
        ).resolves.toBeUndefined()
        expect(fetch).not.toHaveBeenCalled()
    } finally {
        vi.unstubAllGlobals()
    }
})
