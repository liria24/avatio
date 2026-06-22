import { describe, expect, it, vi } from 'vitest'

type SetupImagesModule = typeof import('../../../server/utils/setupImages')

vi.mock('@@/database/schema', () => ({
    setupImages: {
        objectKey: 'objectKey',
        width: 'width',
        height: 'height',
        themeColors: 'themeColors',
        contentType: 'contentType',
        size: 'size',
        etag: 'etag',
        setupId: 'setupId',
    },
}))

vi.mock('drizzle-orm', () => ({
    and: () => true,
    eq: () => true,
    inArray: () => true,
}))

vi.mock('../../../server/utils/storage', () => ({
    storage: {
        url: async (key: string) => `https://files.example.com/${key}`,
    },
}))

const serverError = {
    badRequest: (body?: unknown) => Object.assign(new Error('Bad Request'), { body }),
}

vi.stubGlobal('serverError', serverError)

const loadSetupImages = async (): Promise<SetupImagesModule> =>
    await import('../../../server/utils/setupImages')

const createDb = (existingImages: unknown[] = []) => ({
    select: () => ({
        from: () => ({
            where: async () => existingImages,
        }),
    }),
})

describe('isUserSetupImageKey', () => {
    it('allows setup images below the current user prefix', async () => {
        const { isUserSetupImageKey } = await loadSetupImages()

        expect(isUserSetupImageKey('setup/user-1/image.jpg', 'user-1')).toBe(true)
    })

    it('rejects setup images below another user prefix', async () => {
        const { isUserSetupImageKey } = await loadSetupImages()

        expect(isUserSetupImageKey('setup/user-2/image.jpg', 'user-1')).toBe(false)
    })
})

describe('resolveSetupImageData', () => {
    it('accepts new uploaded setup images owned by the current user', async () => {
        const { resolveSetupImageData } = await loadSetupImages()

        const imageData = await resolveSetupImageData(createDb() as ReturnType<typeof useDB>, {
            userId: 'user-1',
            images: ['https://files.example.com/setup/user-1/image.jpg'],
            imageMetadata: {
                'https://files.example.com/setup/user-1/image.jpg': {
                    objectKey: 'setup/user-1/image.jpg',
                    width: 640,
                    height: 480,
                },
            },
        })

        expect(imageData).toEqual([
            {
                objectKey: 'setup/user-1/image.jpg',
                width: 640,
                height: 480,
                themeColors: null,
                contentType: null,
                size: null,
                etag: null,
            },
        ])
    })

    it('rejects new uploaded setup images owned by another user', async () => {
        const { resolveSetupImageData } = await loadSetupImages()

        await expect(
            resolveSetupImageData(createDb() as ReturnType<typeof useDB>, {
                userId: 'user-1',
                images: ['https://files.example.com/setup/user-2/image.jpg'],
                imageMetadata: {
                    'https://files.example.com/setup/user-2/image.jpg': {
                        objectKey: 'setup/user-2/image.jpg',
                        width: 640,
                        height: 480,
                    },
                },
            }),
        ).rejects.toThrow('Bad Request')
    })

    it('reuses image metadata already attached to the edited setup', async () => {
        const { resolveSetupImageData } = await loadSetupImages()

        const existingImage = {
            objectKey: 'legacy/custom-key.jpg',
            width: 320,
            height: 240,
            themeColors: ['#ffffff'],
            contentType: 'image/jpeg',
            size: 1024,
            etag: 'etag',
        }

        const imageData = await resolveSetupImageData(
            createDb([existingImage]) as ReturnType<typeof useDB>,
            {
                userId: 'user-1',
                setupId: 'setup-1',
                images: ['https://files.example.com/legacy/custom-key.jpg'],
                imageMetadata: {
                    'https://files.example.com/legacy/custom-key.jpg': {
                        objectKey: 'legacy/custom-key.jpg',
                        width: 999,
                        height: 999,
                    },
                },
            },
        )

        expect(imageData).toEqual([existingImage])
    })
})
