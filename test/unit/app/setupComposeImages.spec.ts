import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'

import { useSetupComposeImages } from '../../../app/composables/setupComposeImages'

const uploadedImage = (name: string) => ({
    url: `https://files.example.com/setup/user/${name}`,
    objectKey: `setup/user/${name}`,
    contentType: 'image/png',
    size: 10,
    etag: name,
    width: 100,
    height: 100,
    themeColors: [],
})

describe('setup compose image uploads', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('keeps selection order when an earlier failed upload is retried later', async () => {
        const images = ref<string[]>([])
        const metadata = ref<Record<string, SetupImageMetadata>>({})
        const uploadImage = vi
            .fn()
            .mockRejectedValueOnce(new Error('temporary'))
            .mockResolvedValueOnce(uploadedImage('second.png'))
            .mockResolvedValueOnce(uploadedImage('first.png'))
        vi.stubGlobal('uploadImage', uploadImage)
        vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
        vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
        vi.stubGlobal('ref', ref)
        vi.stubGlobal('computed', computed)

        const scope = effectScope()
        const compose = scope.run(() =>
            useSetupComposeImages(images, (next) => (images.value = next), metadata),
        )!
        compose.processImages([
            new File(['first'], 'first.png', { type: 'image/png' }),
            new File(['second'], 'second.png', { type: 'image/png' }),
        ])

        await vi.waitFor(() => expect(images.value).toEqual([uploadedImage('second.png').url]))
        const failed = compose.uploads.value.find(({ status }) => status === 'failed')
        expect(failed?.file.name).toBe('first.png')
        compose.retryUpload(failed!.id)
        await vi.waitFor(() =>
            expect(images.value).toEqual([
                uploadedImage('first.png').url,
                uploadedImage('second.png').url,
            ]),
        )
        scope.stop()
    })
})
