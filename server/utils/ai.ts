import { createWorkersAiCapabilities, type AiTaskModels } from '@avatio/cloudflare'
import { itemCategories } from '@avatio/core/catalog'
import type { H3Event } from '@nuxt/nitro-server/h3'
import { z } from 'zod'

const modelBindings = {
    catalogEnrichment: 'AI_MODEL_CATALOG_ENRICHMENT',
    changelogTranslation: 'AI_MODEL_CHANGELOG_TRANSLATION',
    changelogSlug: 'AI_MODEL_CHANGELOG_SLUG',
} as const

const requireModel = (name: keyof AiTaskModels, event: H3Event) => {
    const bindingName = modelBindings[name]
    const model = getRuntimeEnvString(bindingName, event)
    if (!model)
        throw createError({
            statusCode: 503,
            message: `AI task configuration is unavailable: ${name}.`,
        })
    return model
}

/** Root composition boundary for semantic AI capabilities. */
export const useAiCapabilities = (event: H3Event) => {
    const binding = getRuntimeEnv(event).AI
    if (!binding)
        throw createError({
            statusCode: 503,
            message: 'AI binding is unavailable in this environment.',
        })

    return createWorkersAiCapabilities({
        binding,
        models: {
            catalogEnrichment: requireModel('catalogEnrichment', event),
            changelogTranslation: requireModel('changelogTranslation', event),
            changelogSlug: requireModel('changelogSlug', event),
        },
        itemCategories,
    })
}

export const changelogTranslationSchema = z.object({
    title: z.string().min(1),
    markdown: z.string().min(1),
})

export const parseChangelogTranslation = (value: string) => {
    const parsed = JSON.parse(value.trim()) as unknown
    return changelogTranslationSchema.parse(sanitizeObject(parsed))
}

export interface GenerateCatalogAttributesParams {
    sourceId: string
    name: string
    description?: {
        description: string
        readme?: string
    }
    originalCategory?: string
}

export const generateCatalogAttributes = async (
    db: ReturnType<typeof useDB>,
    params: GenerateCatalogAttributesParams,
) => {
    const previousItems = await db.query.catalogItems.findMany({
        where: {
            displayNameOverride: { isNotNull: true },
        },
        columns: {
            displayNameOverride: true,
            categoryOverride: true,
        },
        with: {
            sources: {
                where: { primary: { eq: true } },
                columns: { displayName: true, mappedCategory: true },
            },
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
            name: item.sources[0]?.displayName ?? item.displayNameOverride ?? '',
            displayName: item.displayNameOverride,
            category: item.categoryOverride ?? item.sources[0]?.mappedCategory ?? 'other',
        })),
    })

    return {
        displayName: enriched.displayName ?? params.name,
        category: itemCategorySchema.parse(enriched.category),
    }
}
