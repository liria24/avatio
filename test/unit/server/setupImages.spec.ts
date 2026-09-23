import { describe, expect, it, vi } from 'vitest'

import type { AppDatabase } from '../../../server/utils/database'

type SetupImagesModule = typeof import('../../../server/utils/setupImages')

vi.mock('@@/database/schema', () => ({
    setupImages: {
        id: 'id',
        stableId: 'stableId',
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

vi.stubGlobal('useServerFiles', () => ({
    url: async (key: string) => `https://files.example.com/${key}`,
}))

const serverError = {
    badRequest: (body?: unknown) => Object.assign(new Error('Bad Request'), { body }),
}

vi.stubGlobal('serverError', serverError)

const loadSetupImages = async (): Promise<SetupImagesModule> =>
    await import('../../../server/utils/setupImages')

const createDb = (...queryResults: unknown[][]): AppDatabase => {
    let queryIndex = 0
    return {
        select: () => ({
            from: () => ({
                where: async () => queryResults[queryIndex++] ?? [],
            }),
        }),
    } as unknown as AppDatabase
}

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

        const imageData = await resolveSetupImageData(createDb(), {
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
            expect.objectContaining({
                id: undefined,
                stableId: expect.any(String),
                position: 0,
                objectKey: 'setup/user-1/image.jpg',
                width: 640,
                height: 480,
                themeColors: null,
                contentType: null,
                size: null,
                etag: null,
            }),
        ])
    })

    it('rejects new uploaded setup images owned by another user', async () => {
        const { resolveSetupImageData } = await loadSetupImages()

        await expect(
            resolveSetupImageData(createDb(), {
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
            id: 7,
            stableId: 'stable-image',
            objectKey: 'legacy/custom-key.jpg',
            width: 320,
            height: 240,
            themeColors: ['#ffffff'],
            contentType: 'image/jpeg',
            size: 1024,
            etag: 'etag',
        }

        const imageData = await resolveSetupImageData(
            createDb([existingImage], [{ stableId: 'stable-image', setupId: 'setup-1' }]),
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

        expect(imageData).toEqual([{ ...existingImage, position: 0 }])
    })

    it('rejects duplicate object keys and stable IDs', async () => {
        const { resolveSetupImageData } = await loadSetupImages()
        const metadata = {
            objectKey: 'setup/user-1/image.jpg',
            id: 'image-id',
            width: 640,
            height: 480,
        }

        await expect(
            resolveSetupImageData(createDb(), {
                userId: 'user-1',
                images: ['first', 'second'],
                imageMetadata: { first: metadata, second: metadata },
            }),
        ).rejects.toThrow('Bad Request')
        await expect(
            resolveSetupImageData(createDb(), {
                userId: 'user-1',
                images: ['first', 'second'],
                imageMetadata: {
                    first: metadata,
                    second: { ...metadata, objectKey: 'setup/user-1/second.jpg' },
                },
            }),
        ).rejects.toThrow('Bad Request')
    })

    it('rejects a stable ID claimed by another setup', async () => {
        const { resolveSetupImageData } = await loadSetupImages()

        await expect(
            resolveSetupImageData(
                createDb([{ stableId: 'claimed-image', setupId: 'another-setup' }]),
                {
                    userId: 'user-1',
                    images: ['image'],
                    imageMetadata: {
                        image: {
                            id: 'claimed-image',
                            objectKey: 'setup/user-1/image.jpg',
                            width: 640,
                            height: 480,
                        },
                    },
                },
            ),
        ).rejects.toThrow('Bad Request')
    })
})
