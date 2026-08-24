export interface GenerateItemAttrParams {
    sourceId: string
    name: string
    description?: {
        description: string
        readme?: string
    }
    originalCategory?: string
}

export default async (db: ReturnType<typeof useDB>, params: GenerateItemAttrParams) => {
    const previousItems = await db.query.items.findMany({
        where: {
            niceName: { isNotNull: true },
        },
        columns: {
            name: true,
            niceName: true,
            category: true,
        },
        limit: MAX_ITEMS_PER_SETUP,
    })

    const { catalogItemEnricher } = useAiCapabilities(useEvent())
    const enriched = await catalogItemEnricher.enrich({
        sourceId: params.sourceId,
        name: params.name,
        description: params.description?.description,
        readme: params.description?.readme,
        originalCategory: params.originalCategory,
        examples: previousItems.map((item) => ({
            name: item.name,
            displayName: item.niceName,
            category: item.category,
        })),
    })

    return {
        niceName: enriched.displayName ?? params.name,
        category: itemCategorySchema.parse(enriched.category),
    }
}
