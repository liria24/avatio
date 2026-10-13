import { drizzle } from 'drizzle-orm/node-sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { relations } from '../../../database/relations'
import { users, setups, setupImages } from '../../../database/schema'
import * as setupImagesModule from '../../../server/utils/setupImages'
import { createTestD1 } from '../../helpers/d1'
const databases: ReturnType<typeof createTestD1>[] = []
afterEach(() => {
    for (const database of databases.splice(0)) database.sqlite.close()
    vi.unstubAllGlobals()
})
const loadSetupImages = async () => {
    vi.stubGlobal('serverError', {
        badRequest: (body?: unknown) => Object.assign(new Error('Bad Request'), { body }),
    })
    return setupImagesModule
}
const createDb = (...results: Partial<typeof setupImages.$inferInsert>[][]) => {
    const database = createTestD1()
    databases.push(database)
    const db = drizzle({ client: database.sqlite, relations })
    for (const id of ['user-1', 'user-2'])
        db.insert(users)
            .values({
                id,
                name: id,
                username: id,
                displayUsername: id,
                email: id + '@example.test',
            })
            .run()
    for (const id of ['setup-1', 'another-setup'])
        db.insert(setups).values({ id, name: id, userId: 'user-1' }).run()
    const existing = new Set<string>()
    for (const image of results.flat()) {
        if (!image.stableId || existing.has(image.stableId)) continue
        existing.add(image.stableId)
        db.insert(setupImages)
            .values({
                setupId: 'setup-1',
                objectKey: 'setup/user-1/' + image.stableId + '.jpg',
                width: 320,
                height: 240,
                ...image,
                stableId: image.stableId,
            })
            .run()
    }
    return db
}

describe('resolveSetupImageData', () => {
    it('cannot reuse a legacy key from a different setup through an unfenced query', async () => {
        const { resolveSetupImageData } = await loadSetupImages()
        await expect(
            resolveSetupImageData(
                createDb([
                    {
                        stableId: 'foreign-image',
                        setupId: 'another-setup',
                        objectKey: 'legacy/foreign.jpg',
                    },
                ]),
                {
                    userId: 'user-1',
                    setupId: 'setup-1',
                    images: ['https://files.example.test/legacy/foreign.jpg'],
                    imageMetadata: {
                        'https://files.example.test/legacy/foreign.jpg': {
                            id: 'foreign-image',
                            objectKey: 'legacy/foreign.jpg',
                            width: 320,
                            height: 240,
                        },
                    },
                },
            ),
        ).rejects.toThrow('Bad Request')
    })
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
