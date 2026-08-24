import { items, itemSources } from '@@/database/schema'
import { inArray } from 'drizzle-orm'

import type { AppDatabase } from './database'

export interface LegacySetupItemWrite {
    id: string
    setupId: string
    itemId: string
    category?: ItemCategory | null
    unsupported?: boolean
    note?: string | null
}

export interface LegacySetupShapekeyWrite {
    setupItemId: string
    name: string
    value: number
}

export const mapV2SetupEntryWrites = async (
    db: AppDatabase,
    entries: LegacySetupItemWrite[],
    shapekeys: LegacySetupShapekeyWrite[],
) => {
    if (!entries.length) return { entries: [], shapekeys: [] }
    const externalIds = [...new Set(entries.map((entry) => entry.itemId))]
    const [legacyItems, sources] = await Promise.all([
        db
            .select({ id: items.id, platform: items.platform })
            .from(items)
            .where(inArray(items.id, externalIds)),
        db
            .select({
                itemId: itemSources.itemId,
                providerKey: itemSources.providerKey,
                externalId: itemSources.externalId,
            })
            .from(itemSources)
            .where(inArray(itemSources.externalId, externalIds)),
    ])
    const providerByExternalId = new Map(legacyItems.map((item) => [item.id, item.platform]))
    const catalogItemByExternalId = new Map(
        sources.flatMap((source) =>
            providerByExternalId.get(source.externalId) === source.providerKey
                ? [[source.externalId, source.itemId] as const]
                : [],
        ),
    )
    if (entries.some((entry) => !catalogItemByExternalId.has(entry.itemId))) return null

    return {
        entries: entries.map((entry) => ({
            id: entry.id,
            setupId: entry.setupId,
            itemId: catalogItemByExternalId.get(entry.itemId)!,
            categoryOverride: entry.category ?? null,
            unsupported: entry.unsupported ?? false,
            note: entry.note ?? null,
        })),
        shapekeys: shapekeys.map((shapekey) => ({
            setupEntryId: shapekey.setupItemId,
            name: shapekey.name,
            value: shapekey.value,
        })),
    }
}
