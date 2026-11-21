import { resolveEffectiveCategory } from '@avatio/core/catalog'
import type { SetupEntryView } from '~~/shared/types/catalog'

export interface SetupQueryViewer {
    userId: string
    role?: string | null
}

export interface SetupQueryResult {
    setup: Setup
    catalogItemIds: string[]
    sourceIds: string[]
}

export const projectSetupEntry = (entry: {
    id: string
    position: number
    categoryOverride: ItemCategory | null
    unsupported: boolean
    note: string | null
    item: Parameters<typeof projectCatalogItem>[0]
    shapekeys: { name: string; value: number }[]
}): SetupEntryView => ({
    id: entry.id,
    position: entry.position,
    catalogItem: projectCatalogItem(entry.item),
    category: resolveEffectiveCategory({
        setupOverride: entry.categoryOverride,
        catalogOverride: entry.item.categoryOverride,
        primarySourceCategory: entry.item.sources.find((source) => source.primary)?.mappedCategory,
    }),
    categoryOverride: entry.categoryOverride,
    unsupported: entry.unsupported,
    note: entry.note,
    shapekeys: entry.shapekeys.map(({ name, value }) => ({ name, value })),
})

export const querySetupProjection = async (
    db: AppDatabase,
    id: string,
    viewer?: SetupQueryViewer,
): Promise<SetupQueryResult | null> => {
    const data = await db.query.setups.findFirst({
        where: {
            id: { eq: id },
            user: { OR: [{ banned: { eq: false } }, { banned: { isNull: true } }] },
        },
        columns: {
            id: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
            public: true,
            name: true,
            description: true,
            hidAt: true,
            hidReason: true,
        },
        with: {
            user: {
                columns: {
                    id: true,
                    username: true,
                    createdAt: true,
                    name: true,
                    image: true,
                    bio: true,
                    links: true,
                },
                with: { badges: { columns: { badge: true, createdAt: true } } },
            },
            entries: {
                columns: {
                    id: true,
                    position: true,
                    categoryOverride: true,
                    unsupported: true,
                    note: true,
                },
                with: {
                    item: { with: catalogItemRelations },
                    shapekeys: { columns: { id: true, name: true, value: true } },
                },
            },
            images: {
                columns: {
                    id: true,
                    stableId: true,
                    position: true,
                    objectKey: true,
                    width: true,
                    height: true,
                    themeColors: true,
                    contentType: true,
                    size: true,
                    etag: true,
                },
            },
            points: {
                columns: {
                    id: true,
                    imageId: true,
                    setupEntryId: true,
                    x: true,
                    y: true,
                },
            },
            tags: { columns: { tag: true } },
            coauthors: {
                where: {
                    user: { OR: [{ banned: { eq: false } }, { banned: { isNull: true } }] },
                },
                columns: { note: true },
                with: {
                    user: {
                        columns: {
                            id: true,
                            username: true,
                            createdAt: true,
                            name: true,
                            image: true,
                            bio: true,
                            links: true,
                        },
                        with: { badges: { columns: { badge: true, createdAt: true } } },
                    },
                },
            },
        },
    })
    if (!data) return null
    const canView =
        (!data.hidAt && data.public) || viewer?.role === 'admin' || viewer?.userId === data.userId
    if (!canView) return null
    const { userId: _userId, entries, ...setup } = data
    const projectedEntries = entries
        .toSorted((a, b) => a.position - b.position)
        .map(projectSetupEntry)
    return {
        setup: {
            ...setup,
            images: await withSetupImageUrls(data.images),
            entries: projectedEntries,
            points: data.points.map(({ setupEntryId, ...point }) => ({
                ...point,
                entryId: setupEntryId,
            })),
            tags: data.tags.map(({ tag }) => tag),
            failedItemsCount:
                projectedEntries.filter(
                    (entry) => entry.catalogItem.primarySource?.availability !== 'available',
                ).length || undefined,
        },
        catalogItemIds: [...new Set(entries.map((entry) => entry.item.id))],
        sourceIds: [
            ...new Set(entries.flatMap((entry) => entry.item.sources.map((source) => source.id))),
        ],
    }
}
