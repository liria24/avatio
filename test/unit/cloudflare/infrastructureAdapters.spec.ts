import { CloudflareFeatureFlags } from '@avatio/cloudflare'

import { getMaintenanceFlag } from '../../../server/utils/appConfig'
import { getFileStorage } from '../../../server/utils/infrastructure'

afterEach(() => vi.unstubAllGlobals())

describe('Cloudflare infrastructure adapters', () => {
    it('keeps root composition fail-closed when Flagship is absent or unavailable', async () => {
        vi.stubGlobal('__env__', {})
        await expect(getMaintenanceFlag()).resolves.toBe(false)
        vi.stubGlobal('__env__', {
            FLAGS: { getBooleanValue: vi.fn().mockRejectedValue(new Error('unavailable')) },
        })
        await expect(getMaintenanceFlag()).resolves.toBe(false)
    })
    it('maps semantic flags and fails closed', async () => {
        const getBooleanValue = vi.fn(async (key: string) => key === 'is-maintenance')
        const flags = new CloudflareFeatureFlags({ getBooleanValue })

        await expect(flags.isEnabled('maintenance')).resolves.toBe(true)
        expect(getBooleanValue).toHaveBeenNthCalledWith(1, 'is-maintenance', false)

        const unavailable = new CloudflareFeatureFlags({
            getBooleanValue: vi.fn(async () => {
                throw new Error('unavailable')
            }),
        })
        await expect(unavailable.isEnabled('maintenance')).resolves.toBe(false)
    })

    it('imports external files into R2 and exposes the configured public URL', async () => {
        const upload = vi.fn(async () => undefined)
        vi.stubGlobal('useServerFiles', () => ({
            upload,
            url: async (key: string) => `https://images.example.com/${encodeURI(key)}`,
        }))
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(new Uint8Array([1, 2, 3]), {
                        headers: { 'content-type': 'image/jpeg' },
                    }),
            ),
        )
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
        expect(upload).toHaveBeenCalledWith(
            'avatar/user image.jpg',
            expect.anything(),
            expect.objectContaining({ contentType: 'image/jpeg' }),
        )
    })
})
