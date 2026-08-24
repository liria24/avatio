import { CloudflareFeatureFlags, R2FileStorage } from '@avatio/cloudflare'
import type { R2Bucket } from '@cloudflare/workers-types'

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
        const storage = new R2FileStorage({
            bucket: { put, delete: remove } as unknown as R2Bucket,
            publicBaseUrl: 'https://images.example.com/',
            fetch: vi.fn(
                async () =>
                    new Response(new Uint8Array([1, 2, 3]), {
                        headers: { 'content-type': 'image/jpeg' },
                    }),
            ),
        })

        await expect(
            storage.importFromUrl({
                sourceUrl: 'https://source.example.com/avatar',
                destinationKey: 'avatar/user image.jpg',
            }),
        ).resolves.toEqual({
            key: 'avatar/user image.jpg',
            url: 'https://images.example.com/avatar/user%20image.jpg',
        })
        expect(put).toHaveBeenCalledWith('avatar/user image.jpg', expect.any(ArrayBuffer), {
            httpMetadata: { contentType: 'image/jpeg' },
        })

        await storage.delete('avatar/user image.jpg')
        expect(remove).toHaveBeenCalledWith('avatar/user image.jpg')
    })
})
