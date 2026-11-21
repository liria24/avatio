import { createDefaultSetupComposeForm, type SetupDraftContent } from '@avatio/core/setups'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    buildDraftImageMetadata,
    buildSetupPublishPayload,
    mapSetupToDraftContent,
    normalizeDraftFormValues,
} from '../../../app/utils/setupComposePayload'
import type { Setup } from '../../../shared/types/database'

describe('setupComposePayload', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('builds image metadata keyed by image url with fallback ids', () => {
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000099')
        const content: SetupDraftContent = {
            ...createDefaultSetupComposeForm(),
            images: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png'],
            imageMetadata: {
                'https://cdn.example.com/a.png': {
                    id: 'img-a',
                    objectKey: 'setup/user/a.png',
                    width: 800,
                    height: 600,
                    themeColors: ['#ffffff'],
                },
            },
        }

        expect(buildDraftImageMetadata(content)).toEqual({
            'https://cdn.example.com/a.png': {
                id: 'img-a',
                objectKey: 'setup/user/a.png',
                width: 800,
                height: 600,
                themeColors: ['#ffffff'],
            },
            'https://cdn.example.com/b.png': {
                id: '00000000-0000-4000-8000-000000000099',
            },
        })
    })

    it('normalizes draft form values by omitting imageMetadata and ensuring entry ids', () => {
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000042')
        const content: SetupDraftContent = {
            ...createDefaultSetupComposeForm(),
            name: 'Normalized',
            images: ['https://cdn.example.com/a.png'],
            imageMetadata: {
                'https://cdn.example.com/a.png': {
                    id: 'img-a',
                    objectKey: 'setup/user/a.png',
                    width: 800,
                    height: 600,
                },
            },
            items: [
                {
                    itemId: 'item-1',
                    category: 'avatar',
                    note: '',
                    unsupported: false,
                    shapekeys: [],
                },
                {
                    id: 'existing-entry-id',
                    itemId: 'item-2',
                    category: 'hair',
                    note: 'note',
                    unsupported: true,
                    shapekeys: [{ name: 'bangs', value: 0.5 }],
                },
            ],
        }

        const result = normalizeDraftFormValues(content)
        expect('imageMetadata' in result).toBe(false)
        expect(result.points).toEqual([])
        expect(result.items).toEqual([
            {
                id: '00000000-0000-4000-8000-000000000042',
                itemId: 'item-1',
                category: 'avatar',
                note: '',
                unsupported: false,
                shapekeys: [],
            },
            {
                id: 'existing-entry-id',
                itemId: 'item-2',
                category: 'hair',
                note: 'note',
                unsupported: true,
                shapekeys: [{ name: 'bangs', value: 0.5 }],
            },
        ])
    })

    it('maps a persisted setup record into draft content with image metadata and coauthors', () => {
        const setup = {
            id: 'setup-1',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-02T00:00:00Z'),
            public: false,
            name: 'My Setup',
            description: null,
            user: {
                id: 'user-1',
                username: 'owner',
                name: 'Owner',
                image: null,
            },
            images: [
                {
                    id: 'img-1',
                    position: 0,
                    objectKey: 'setup/owner/1.png',
                    width: 1024,
                    height: 768,
                    themeColors: null,
                    contentType: 'image/png',
                    size: 12345,
                    etag: null,
                    url: 'https://cdn.example.com/1.png',
                },
            ],
            tags: ['vrchat'],
            coauthors: [
                {
                    note: null,
                    user: {
                        id: 'user-2',
                        username: 'coauthor',
                        name: 'Coauthor',
                        image: null,
                    },
                },
            ],
            entries: [
                {
                    id: 'entry-1',
                    category: 'avatar',
                    note: null,
                    unsupported: false,
                    shapekeys: [{ name: 'blink', value: 1 }],
                    catalogItem: {
                        id: 'item-1',
                        name: 'Avatar Item',
                        image: null,
                        category: 'avatar',
                        primarySource: null,
                    },
                },
            ],
            points: [{ id: 'p-1', imageId: 'img-1', entryId: 'entry-1', x: 0.5, y: 0.5 }],
        } as unknown as Setup

        expect(mapSetupToDraftContent(setup)).toEqual({
            public: false,
            name: 'My Setup',
            description: '',
            images: ['https://cdn.example.com/1.png'],
            tags: ['vrchat'],
            coauthors: [{ userId: 'user-2', username: 'coauthor', note: '' }],
            items: [
                {
                    id: 'entry-1',
                    itemId: 'item-1',
                    category: 'avatar',
                    note: '',
                    unsupported: false,
                    shapekeys: [{ name: 'blink', value: 1 }],
                },
            ],
            points: [{ id: 'p-1', imageId: 'img-1', entryId: 'entry-1', x: 0.5, y: 0.5 }],
            imageMetadata: {
                'https://cdn.example.com/1.png': {
                    id: 'img-1',
                    objectKey: 'setup/owner/1.png',
                    contentType: 'image/png',
                    size: 12345,
                    etag: undefined,
                    width: 1024,
                    height: 768,
                    themeColors: null,
                },
            },
        })
    })

    it('builds the publish payload with normalized tags and optional coauthor notes', () => {
        const form = {
            ...createDefaultSetupComposeForm(),
            public: true,
            name: 'Published Setup',
            description: 'Desc',
            images: ['https://cdn.example.com/1.png'],
            tags: ['avatar', 'cute'],
            coauthors: [
                { userId: 'u-1', username: 'first', note: 'Hair' },
                { userId: 'u-2', username: 'second', note: '' },
            ],
            items: [],
            points: [],
        }
        const imageMetadata = {
            'https://cdn.example.com/1.png': {
                id: 'img-1',
                objectKey: 'setup/1.png',
                width: 500,
                height: 500,
            },
        }

        expect(buildSetupPublishPayload(form, imageMetadata)).toEqual({
            public: true,
            name: 'Published Setup',
            description: 'Desc',
            items: [],
            images: ['https://cdn.example.com/1.png'],
            imageMetadata,
            points: [],
            tags: [{ tag: 'avatar' }, { tag: 'cute' }],
            coauthors: [
                { userId: 'u-1', note: 'Hair' },
                { userId: 'u-2', note: undefined },
            ],
        })
        expect(buildSetupPublishPayload(form, imageMetadata, false)).not.toHaveProperty('points')
    })
})
