import { createWorkersAiCapabilities, type AiTaskModels } from '@avatio/cloudflare'
import type { H3Event } from 'h3'

import { itemCategory } from '../../database/schema'
import { getRuntimeEnv, getRuntimeEnvString } from './runtimeEnv'

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
        itemCategories: itemCategory,
    })
}
