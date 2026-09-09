import { CloudflareFeatureFlags } from '@avatio/cloudflare'
import { r2 } from 'files-sdk/r2'
import { configureFiles } from 'nuxt-files-sdk/runtime'

import filesConfig from '../../../files.config'
import { getFileStorage } from '../../../server/utils/infrastructure'

afterEach(() => vi.unstubAllGlobals())

describe('Cloudflare infrastructure adapters', () => {
    it('maps semantic flags and fails closed', async () => {
        const getBooleanValue = vi.fn(async (key: string) => key === 'is-maintenance')
        const flags = new CloudflareFeatureFlags({ getBooleanValue })

        await expect(flags.isEnabled('maintenance')).resolves.toBe(true)
        await expect(flags.isEnabled('catalogV2Reads')).resolves.toBe(false)
        expect(getBooleanValue).toHaveBeenNthCalledWith(1, 'is-maintenance', false)
        expect(getBooleanValue).toHaveBeenNthCalledWith(2, 'catalog-v2-reads', false)

        const unavailable = new CloudflareFeatureFlags({
            getBooleanValue: vi.fn(async () => {
                throw new Error('unavailable')
            }),
        })
        await expect(unavailable.isEnabled('maintenance')).resolves.toBe(false)
    })

    it('imports external files into R2 and exposes the configured public URL', async () => {
        const put = vi.fn(async () => null)
        const remove = vi.fn(async () => undefined)
        vi.stubGlobal('__env__', {
            R2: { put, delete: remove },
            R2_PUBLIC_BASE_URL: 'https://images.example.com/',
        })
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(new Uint8Array([1, 2, 3]), {
                        headers: { 'content-type': 'image/jpeg' },
                    }),
            ),
        )
        configureFiles(filesConfig, { factories: { r2 } })
        const storage = getFileStorage()

        await expect(
            storage.importFromUrl({
                sourceUrl: 'https://source.example.com/avatar',
                destinationKey: 'avatar/user image.jpg',
            }),
        ).resolves.toEqual({
            key: 'avatar/user image.jpg',
            url: 'https://images.example.com/avatar/user%20image.jpg',
        })
        expect(put).toHaveBeenCalledWith(
            'avatar/user image.jpg',
            expect.anything(),
            expect.objectContaining({
                httpMetadata: expect.objectContaining({ contentType: 'image/jpeg' }),
            }),
        )

        await storage.delete('avatar/user image.jpg')
        expect(remove).toHaveBeenCalledWith('avatar/user image.jpg')
    })
})
