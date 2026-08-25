import { resolveEffectiveCategory } from '@avatio/core/catalog'

export interface SetupQueryViewer {
    userId: string
    role?: string | null
}

export interface SetupQueryResult {
    setup: Setup
    catalogItemIds: string[]
    sourceIds: string[]
    legacyRevalidationItems: { id: string; platform: Platform; updatedAt: Date }[]
    v2: boolean
}

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
            items: {
                columns: { id: true, category: true, unsupported: true, note: true },
                with: {
                    item: {
                        columns: {
                            id: true,
                            updatedAt: true,
                            platform: true,
                            category: true,
                            name: true,
                            niceName: true,
                            image: true,
                            price: true,
                            likes: true,
                            nsfw: true,
                            outdated: true,
                        },
                        with: {
                            shop: {
                                columns: {
                                    id: true,
                                    platform: true,
                                    name: true,
                                    image: true,
                                    verified: true,
                                },
                            },
                        },
                    },
                    shapekeys: { columns: { name: true, value: true } },
                },
            },
            entries: {
                columns: {
                    id: true,
                    categoryOverride: true,
                    unsupported: true,
                    note: true,
                },
                with: {
                    item: {
                        columns: {
                            id: true,
                            displayNameOverride: true,
                            categoryOverride: true,
                        },
                        with: {
                            sources: {
                                columns: {
                                    id: true,
                                    providerKey: true,
                                    externalId: true,
                                    primary: true,
                                    availability: true,
                                    mappedCategory: true,
                                    displayName: true,
                                    image: true,
                                    price: true,
                                    popularityCount: true,
                                    nsfw: true,
                                    metadata: true,
                                },
                                with: {
                                    publisherSource: {
                                        columns: {
                                            externalId: true,
                                            name: true,
                                            image: true,
                                            providerVerified: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    shapekeys: { columns: { name: true, value: true } },
                },
            },
            images: { columns: { objectKey: true, width: true, height: true } },
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

    const canView = viewer
        ? (!data.hidAt && data.public) || viewer.role === 'admin' || viewer.userId === data.userId
        : !data.hidAt && data.public
    if (!canView) return null

    const legacyEntryIds = new Set(data.items.map((entry) => entry.id))
    const useV2 =
        data.entries.length === data.items.length &&
        data.entries.every((entry) => legacyEntryIds.has(entry.id))
    const catalogItemIds = useV2 ? [...new Set(data.entries.map((entry) => entry.item.id))] : []
    const sourceIds = useV2
        ? [
              ...new Set(
                  data.entries.flatMap((entry) => entry.item.sources.map((source) => source.id)),
              ),
          ]
        : []
    const projectedItems: SetupItem[] = []
    let failedItemsCount = 0

    if (useV2) {
        for (const entry of data.entries) {
            const primarySource = entry.item.sources.find((source) => source.primary)
            if (!primarySource || primarySource.availability !== 'available') {
                failedItemsCount++
                continue
            }

            const projected = projectCatalogSourceToLegacySetupItem({
                source: primarySource,
                displayNameOverride: entry.item.displayNameOverride,
                category: resolveEffectiveCategory({
                    setupOverride: entry.categoryOverride,
                    catalogOverride: entry.item.categoryOverride,
                    primarySourceCategory: primarySource.mappedCategory,
                }),
                unsupported: entry.unsupported,
                note: entry.note,
                shapekeys: entry.shapekeys,
            })
            if (projected) projectedItems.push(projected)
            else failedItemsCount++
        }
    } else {
        for (const entry of data.items) {
            if (entry.item.outdated) {
                failedItemsCount++
                continue
            }
            projectedItems.push({
                id: entry.item.id,
                platform: entry.item.platform,
                category: entry.category || entry.item.category,
                name: entry.item.name,
                niceName: entry.item.niceName,
                image: entry.item.image,
                price: entry.item.price,
                likes: entry.item.likes,
                nsfw: entry.item.nsfw,
                outdated: entry.item.outdated,
                shop: entry.item.shop,
                unsupported: entry.unsupported,
                note: entry.note,
                shapekeys: entry.shapekeys,
            })
        }
    }

    const { items: legacyItems, entries: _entries, ...setup } = data
    return {
        setup: {
            ...setup,
            images: await withSetupImageUrls(data.images),
            items: projectedItems,
            tags: data.tags.map(({ tag }) => tag),
            failedItemsCount: failedItemsCount || undefined,
        },
        catalogItemIds,
        sourceIds,
        legacyRevalidationItems: useV2
            ? []
            : legacyItems.map(({ item }) => ({
                  id: item.id,
                  platform: item.platform,
                  updatedAt: item.updatedAt,
              })),
        v2: useV2,
    }
}
