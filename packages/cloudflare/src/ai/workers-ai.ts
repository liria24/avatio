import type { CatalogItemEnricher, ChangelogSlugGenerator, ChangelogTranslator } from '@avatio/core'
import { generateText, Output } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import { z } from 'zod'

export type AiTaskKey = 'catalogEnrichment' | 'changelogTranslation' | 'changelogSlug'

export type AiTaskModels = Record<AiTaskKey, string>

export interface WorkersAiCapabilities {
    catalogItemEnricher: CatalogItemEnricher
    changelogTranslator: ChangelogTranslator
    changelogSlugGenerator: ChangelogSlugGenerator
}

interface WorkersAiCapabilitiesOptions {
    binding: NonNullable<Parameters<typeof createWorkersAI>[0]['binding']>
    models: AiTaskModels
    itemCategories: readonly [string, ...string[]]
}

const catalogSystemPrompt = (categories: readonly string[]) => `
EC サイトや GitHub で配布されているデジタル商品の情報から、アイテム名とカテゴリーを抽出してください。

- displayName は固有名詞のみとし、カテゴリー表記や不要な括弧書きを除いてください。
- 元の大文字小文字、ひらがな、カタカナを維持してください。
- category は ${categories.join(', ')} のいずれかを選んでください。
- 名前と説明だけで判断できない場合は originalCategory を参考にしてください。
`

export const getAiTaskModel = (models: AiTaskModels, task: AiTaskKey) => models[task]

export const createWorkersAiCapabilities = (
    options: WorkersAiCapabilitiesOptions,
): WorkersAiCapabilities => {
    const workersAi = createWorkersAI({ binding: options.binding })
    const catalogResultSchema = z.object({
        displayName: z.string().min(1),
        category: z.enum(options.itemCategories),
    })
    const translationResultSchema = z.object({
        title: z.string().min(1),
        content: z.string().min(1),
    })

    return {
        catalogItemEnricher: {
            async enrich(input) {
                const examples = input.examples?.length
                    ? `\n既存アイテムの例:\n${input.examples
                          .map(
                              (item) =>
                                  `${item.name}: ${item.displayName ?? ''} [${item.category}]`,
                          )
                          .join('\n')}`
                    : ''
                const { output } = await generateText({
                    model: workersAi(getAiTaskModel(options.models, 'catalogEnrichment')),
                    system: catalogSystemPrompt(options.itemCategories),
                    prompt: `${JSON.stringify({
                        name: input.name,
                        description: input.description,
                        readme: input.readme,
                        originalCategory: input.originalCategory,
                    })}${examples}`,
                    output: Output.object({ schema: catalogResultSchema }),
                })

                return {
                    displayName: output.displayName.replaceAll('　', ' ').trim(),
                    category: output.category,
                }
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
