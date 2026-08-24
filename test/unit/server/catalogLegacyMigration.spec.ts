import {
    LEGACY_SOURCE_FRESHNESS_MS,
    legacyItemCanonicalUrl,
    legacyPublisherCanonicalUrl,
    migrateLegacyItemState,
    migrateLegacySetupEntry,
    migrateLegacyShapekey,
} from '../../../server/utils/catalogLegacyMigration'

const updatedAt = new Date('2026-08-20T00:00:00.000Z')

const legacyItem = {
    id: '1234567',
    platform: 'booth',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt,
    outdated: false,
    name: 'Legacy avatar',
    niceName: 'Curated avatar',
    category: 'avatar' as const,
    image: 'https://example.com/avatar.png',
    price: '1200 JPY',
    likes: 42,
    nsfw: false,
}

describe('Catalog v2 legacy migration mapping', () => {
    it('maps an available BOOTH item without deriving the future CatalogItem ID', () => {
        const migrated = migrateLegacyItemState(legacyItem)

        expect(migrated.catalog).toEqual({
            displayNameOverride: 'Curated avatar',
            categoryOverride: 'avatar',
            categoryOverrideOrigin: 'legacy',
        })
        expect(migrated.source.availability).toBe('available')
        expect(migrated.source.syncState).toBe('fresh')
        expect(migrated.source.lastSuccessfulSyncAt).toEqual(updatedAt)
        expect(migrated.source.nextCheckAt.getTime()).toBe(
            updatedAt.getTime() + LEGACY_SOURCE_FRESHNESS_MS,
        )
        expect(legacyItemCanonicalUrl('booth', legacyItem.id)).toBe(
            'https://booth.pm/items/1234567',
        )
    })

    it('maps a false-positive outdated item to unknown and due, never withdrawn', () => {
        const migrated = migrateLegacyItemState({ ...legacyItem, outdated: true })

        expect(migrated.source.availability).toBe('unknown')
        expect(migrated.source.syncState).toBe('stale')
        expect(migrated.source.lastSuccessfulSyncAt).toBeNull()
        expect(migrated.source.nextCheckAt).toEqual(new Date(0))
        expect(migrated.source.lastErrorKind).toBe('legacy-unconfirmed-outdated')
    })

    it('preserves an explicit legacy category configuration as an admin override', () => {
        const migrated = migrateLegacyItemState(legacyItem, 'clothing')
        expect(migrated.catalog.categoryOverride).toBe('clothing')
        expect(migrated.catalog.categoryOverrideOrigin).toBe('manual')
    })

    it('preserves GitHub provider identities and canonical URLs', () => {
        expect(legacyItemCanonicalUrl('github', 'owner/repository')).toBe(
            'https://github.com/owner/repository',
        )
        expect(legacyPublisherCanonicalUrl('github', 'owner')).toBe('https://github.com/owner')
    })

    it('preserves SetupEntry and shapekey IDs and relationship fields', () => {
        const entry = migrateLegacySetupEntry(
            {
                id: 'entry_legacy_1',
                setupId: 'AbCd1234',
                category: 'accessory',
                unsupported: true,
                note: 'Keep this note',
            },
            'internal-catalog-id',
        )
        const shapekey = migrateLegacyShapekey({
            id: 91,
            setupItemId: 'entry_legacy_1',
            name: 'Smile',
            value: 0.75,
        })

        expect(entry).toEqual({
            id: 'entry_legacy_1',
            itemId: 'internal-catalog-id',
            setupId: 'AbCd1234',
            categoryOverride: 'accessory',
            unsupported: true,
            note: 'Keep this note',
        })
        expect(shapekey).toEqual({
            id: 91,
            setupEntryId: 'entry_legacy_1',
            name: 'Smile',
            value: 0.75,
        })
    })

    it('rejects providers outside the explicitly migrated legacy set', () => {
        expect(() => legacyItemCanonicalUrl('future-provider', 'x')).toThrow(
            'Unsupported legacy provider',
        )
    })
})
