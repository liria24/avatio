import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const warn = vi.fn()

beforeEach(() => {
    vi.stubGlobal('withSetupImageUrls', async (images: unknown[]) => images)
    vi.stubGlobal('logger', () => ({ warn }))
    warn.mockClear()
})

afterEach(() => vi.unstubAllGlobals())

const baseSetup = () => ({
    id: 'AbCd1234',
    userId: 'owner-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    public: true,
    name: 'Setup',
    description: null,
    hidAt: null,
    hidReason: null,
    user: {
        id: 'owner-1',
        username: 'owner',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        name: 'Owner',
        image: null,
        bio: null,
        links: null,
        badges: [],
    },
    items: [
        {
            id: 'entry-1',
            category: 'accessory' as const,
            unsupported: true,
            note: 'Legacy note',
            item: {
                id: '12345',
                updatedAt: new Date('2026-01-02T00:00:00.000Z'),
                platform: 'booth' as const,
                category: 'avatar' as const,
                name: 'Legacy',
                niceName: null,
                image: null,
                price: null,
                likes: 1,
                nsfw: false,
                outdated: false,
                shop: null,
            },
            shapekeys: [{ name: 'Smile', value: 1 }],
        },
    ],
    entries: [
        {
            id: 'entry-1',
            categoryOverride: 'clothing' as const,
            unsupported: true,
            note: 'V2 note',
            item: {
                id: 'catalog-item-1',
                displayNameOverride: 'Curated name',
                categoryOverride: 'hair' as const,
                sources: [
                    {
                        id: 'source-1',
                        providerKey: 'booth',
                        externalId: '12345',
                        primary: true,
                        availability: 'available' as const,
                        mappedCategory: 'avatar' as const,
                        displayName: 'Provider name',
                        image: 'https://example.com/item.png',
                        price: '1000 JPY',
                        popularityCount: 10,
                        nsfw: false,
                        metadata: {},
                        publisherSource: {
                            externalId: 'creator',
                            name: 'Creator',
                            image: null,
                            providerVerified: true,
                        },
                    },
                ],
            },
            shapekeys: [{ name: 'Smile', value: 1 }],
        },
    ],
    images: [],
    tags: [{ tag: 'VRChat' }],
    coauthors: [],
})

const database = (value: ReturnType<typeof baseSetup>) =>
    ({ query: { setups: { findFirst: vi.fn(async () => value) } } }) as never

describe('Setup v2 compatibility projection', () => {
    it('uses the three-layer category precedence and stable Catalog resource IDs', async () => {
        const { querySetupProjection } = await import('../../../server/utils/setupQuery')
        const result = await querySetupProjection(database(baseSetup()), 'AbCd1234')

        expect(result?.v2).toBe(true)
        expect(result?.projectionSource).toEqual({ mode: 'v2' })
        expect(warn).not.toHaveBeenCalled()
        expect(result?.catalogItemIds).toEqual(['catalog-item-1'])
        expect(result?.sourceIds).toEqual(['source-1'])
        expect(result?.setup.items[0]).toMatchObject({
            id: '12345',
            category: 'clothing',
            name: 'Provider name',
            niceName: 'Curated name',
            note: 'V2 note',
        })
    })

    it.each(['withdrawn', 'policy_rejected', 'unknown'] as const)(
        'hides a %s source without deleting its SetupEntry and reports failure',
        async (availability) => {
            const value = baseSetup()
            value.entries[0]!.item.sources[0]!.availability = availability
            const { querySetupProjection } = await import('../../../server/utils/setupQuery')
            const result = await querySetupProjection(database(value), 'AbCd1234')

            expect(result?.setup.items).toEqual([])
            expect(result?.setup.failedItemsCount).toBe(1)
            expect(result?.sourceIds).toEqual(['source-1'])
        },
    )

    it('falls back to the legacy projection during an incomplete backfill', async () => {
        const value = baseSetup()
        value.entries = []
        const { querySetupProjection } = await import('../../../server/utils/setupQuery')
        const result = await querySetupProjection(database(value), 'AbCd1234')

        expect(result?.v2).toBe(false)
        expect(result?.projectionSource).toEqual({
            mode: 'legacy-fallback',
            reason: 'entry-count-mismatch',
        })
        expect(warn).toHaveBeenCalledWith({
            event: 'catalog.setup.legacy_fallback',
            setupId: 'AbCd1234',
            reason: 'entry-count-mismatch',
        })
        expect(result?.setup.items[0]).toMatchObject({ id: '12345', category: 'accessory' })
        expect(result?.legacyRevalidationItems).toHaveLength(1)
    })

    it.each(['entry-id-mismatch', 'missing-catalog-source'] as const)(
        'records %s without exposing diagnostics in the Setup DTO',
        async (reason) => {
            const value = baseSetup()
            if (reason === 'entry-id-mismatch') value.entries[0]!.id = 'unmapped'
            else value.entries[0]!.item.sources = []
            const { querySetupProjection } = await import('../../../server/utils/setupQuery')
            const result = await querySetupProjection(database(value), 'AbCd1234')
            expect(result?.projectionSource).toEqual({ mode: 'legacy-fallback', reason })
            expect(warn).toHaveBeenCalledWith(expect.objectContaining({ reason }))
            expect(result?.setup).not.toHaveProperty('projectionSource')
        },
    )

    it('keeps private/hidden access out of the public projection', async () => {
        const value = { ...baseSetup(), public: false }
        const { querySetupProjection } = await import('../../../server/utils/setupQuery')

        expect(await querySetupProjection(database(value), 'AbCd1234')).toBeNull()
        expect(
            await querySetupProjection(database(value), 'AbCd1234', { userId: 'owner-1' }),
        ).not.toBeNull()
        expect(
            await querySetupProjection(database(value), 'AbCd1234', { userId: 'other' }),
        ).toBeNull()
    })
})
