import type {
    CatalogClassificationChoice,
    CatalogDisplayNameGenerator,
    CatalogItemClassifier,
    ChangelogSlugGenerator,
    ChangelogTranslator,
    ItemCategory,
} from '@avatio/core'
import { generateText, Output } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import { z } from 'zod'

import { openaiProvider } from './openai-provider'

export type AiTaskKey =
    | 'catalogEnrichment'
    | 'catalogClassification'
    | 'changelogTranslation'
    | 'changelogSlug'

export type AiTaskModels = Record<AiTaskKey, string>

export interface WorkersAiCapabilities {
    catalogDisplayNameGenerator: CatalogDisplayNameGenerator
    changelogTranslator: ChangelogTranslator
    changelogSlugGenerator: ChangelogSlugGenerator
}

interface WorkersAiCapabilitiesOptions {
    binding: NonNullable<Parameters<typeof createWorkersAI>[0]['binding']>
    models: Pick<AiTaskModels, 'catalogEnrichment' | 'changelogTranslation' | 'changelogSlug'>
}

interface CatalogItemClassifierOptions {
    binding: NonNullable<Parameters<typeof createWorkersAI>[0]['binding']>
    model: string
    itemCategories: readonly [ItemCategory, ...ItemCategory[]]
}

export const JEV_CATALOG_CLASSIFIER_VERSION = '1'

const catalogSystemPrompt = `
EC サイトや GitHub で配布されているデジタル商品の情報から、短いアイテム名を抽出してください。

- displayName は固有名詞のみとし、カテゴリー表記や不要な括弧書きを除いてください。
- 元の大文字小文字、ひらがな、カタカナを維持してください。
`

const categoryCriteria: Record<ItemCategory | 'unknown', string> = {
    avatar: '3D avatar or complete character model',
    clothing: 'Wearable clothing made for an avatar',
    accessory: 'Wearable accessory other than clothing or hair',
    hair: 'Hairstyle or hair model',
    shader: 'Shader, material system, or rendering effect',
    texture: 'Texture, image material, or decal asset',
    tool: 'Software, editor extension, automation, or creator utility',
    other: 'Digital item that clearly does not fit another category',
    unknown: 'The supplied information is insufficient to classify reliably',
}

export const getAiTaskModel = <Task extends AiTaskKey>(
    models: Pick<AiTaskModels, Task>,
    task: Task,
) => models[task]

export const createWorkersAiCapabilities = (
    options: WorkersAiCapabilitiesOptions,
): WorkersAiCapabilities => {
    const workersAi = createWorkersAI({ binding: options.binding, providers: [openaiProvider] })
    const catalogResultSchema = z.object({
        displayName: z.string().min(1),
    })
    const translationResultSchema = z.object({
        title: z.string().min(1),
        content: z.string().min(1),
    })

    return {
        catalogDisplayNameGenerator: {
            async generate(input) {
                const examples = input.examples?.length
                    ? `\n既存アイテムの例:\n${input.examples
                          .map((item) => `${item.name}: ${item.displayName ?? ''}`)
                          .join('\n')}`
                    : ''
                const { output } = await generateText({
                    model: workersAi(getAiTaskModel(options.models, 'catalogEnrichment')),
                    system: catalogSystemPrompt,
                    prompt: `${JSON.stringify({
                        name: input.name,
                        description: input.description,
                        readme: input.readme,
                    })}${examples}`,
                    output: Output.object({ schema: catalogResultSchema }),
                })

                return output.displayName.replaceAll('　', ' ').trim()
            },
        },
        changelogTranslator: {
            async translate(input) {
                const { output } = await generateText({
                    model: workersAi(getAiTaskModel(options.models, 'changelogTranslation')),
                    system: 'You are a professional translator. Preserve Markdown formatting.',
                    prompt: `Translate this changelog from ${input.sourceLocale} to ${input.targetLocale}.\n\nTitle: ${input.title}\n\nContent:\n${input.content}`,
                    output: Output.object({ schema: translationResultSchema }),
                })
                return output
            },
        },
        changelogSlugGenerator: {
            async generate(input) {
                const reserved = input.reservedSlugs?.length
                    ? ` The result must differ from: ${input.reservedSlugs.join(', ')}.`
                    : ''
                const { text } = await generateText({
                    model: workersAi(getAiTaskModel(options.models, 'changelogSlug')),
                    system: 'Return only a short lowercase URL slug containing ASCII letters, digits, and hyphens.',
                    prompt: `Create a slug for this changelog title: ${input.title}.${reserved}`,
                })
                return z
                    .string()
                    .trim()
                    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                    .parse(text)
            },
        },
    }
}

export const createCatalogItemClassifier = (
    options: CatalogItemClassifierOptions,
): CatalogItemClassifier => {
    const choices = [...options.itemCategories, 'unknown'] as [
        CatalogClassificationChoice,
        ...CatalogClassificationChoice[],
    ]
    const responseSchema = z.object({
        model: z.string().min(1),
        answers: z.object({
            category: z.object({
                type: z.literal('choice'),
                choice: z.enum(choices),
                confidence: z.number().min(0).max(1),
                probabilities: z.record(z.string(), z.number().min(0).max(1)),
            }),
        }),
    })
    const criteria = Object.fromEntries(
        choices.map((category) => [category, categoryCriteria[category]]),
    )

    return {
        async classify(input, classifyOptions) {
            const response = responseSchema.parse(
                await options.binding.run(
                    options.model,
                    {
                        state: input,
                        questions: {
                            category: {
                                type: 'choice',
                                instructions:
                                    'Choose the single best category for this digital item. Use unknown when the evidence is insufficient.',
                                criteria,
                            },
                        },
                    },
                    { gateway: { id: 'default' }, signal: classifyOptions?.signal },
                ),
            )
            return {
                category: response.answers.category.choice,
                confidence: response.answers.category.confidence,
                probabilities: response.answers.category.probabilities,
                model: response.model,
            }
        },
    }
}
