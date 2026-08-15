import { changelogAuthors, changelogs, changelogI18ns } from '@@/database/schema'
import { generateText } from 'ai'
import type { BatchItem } from 'drizzle-orm/batch'
import { createInsertSchema } from 'drizzle-orm/zod'
import { createWorkersAI } from 'workers-ai-provider'
import { z } from 'zod'

const log = logger('/api/admin/changelogs:POST')

const body = createInsertSchema(changelogI18ns)
    .pick({
        title: true,
        markdown: true,
    })
    .extend({
        slug: z.string().optional(),
        authors: z.string().array().optional(),
        i18n: createInsertSchema(changelogI18ns).array().optional(),
    })

export default adminSessionEventHandler(async ({ event, session, db }) => {
    const { slug, title, markdown, authors, i18n } = await validateBody(body, { sanitize: true })
    const idempotency = await claimIdempotencyRequest({
        event,
        db,
        scope: `user:${session.user.id}`,
        route: '/api/admin/changelogs',
        body: { slug, title, markdown, authors, i18n },
    })
    if (idempotency.replay) return idempotency.response

    let generatedSlug: string = ''

    const exists = await db.query.changelogs.findMany({
        columns: {
            slug: true,
        },
    })

    if (!slug) {
        const messages: { role: 'system' | 'user'; content: string }[] = []
        if (exists.length > 0)
            messages.push({
                role: 'system',
                content: `The short slug must not overlap with any of the existing slugs: ${exists.map((b) => b.slug).join(', ')}`,
            })

        const aiBinding = event.context.cloudflare?.env?.AI
        if (!aiBinding)
            throw createError({
                statusCode: 503,
                message: 'AI binding is unavailable. Provide a slug manually.',
            })
        const workersai = createWorkersAI({ binding: aiBinding })
        const result = await generateText({
            model: workersai('@cf/google/gemini-3.1-flash-lite'),
            messages: [
                ...messages,
                {
                    role: 'user',
                    content: `Create a short slug for the blog with the title: ${title}`,
                },
            ],
            system: 'Please return only the slug as your answer.',
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingLevel: 'low',
                        includeThoughts: false,
                    },
                },
            },
        })

        generatedSlug = result.text.trim()
    }

    const finalSlug = slug || generatedSlug
    idempotency.resourceId = finalSlug
    const translations: (typeof changelogI18ns.$inferInsert)[] = []

    // Handle i18n translations
    if (!i18n || i18n.length === 0) {
        // AI generate translations for both en and ja
        const locales: Array<'en'> = ['en']

        for (const locale of locales) {
            const targetLanguage = 'English'

            const translationResult = await generateText({
                model: 'google/gemini-3.1-flash-lite-preview',
                messages: [
                    {
                        role: 'user',
                        content: `Translate the following changelog to ${targetLanguage}:

Title: ${title}

Content:
${markdown}

Please return the translation in the following JSON format:
{
  "title": "translated title",
  "markdown": "translated markdown content"
}`,
                    },
                ],
                system: `You are a professional translator. Translate the content to ${targetLanguage} while maintaining the markdown formatting. Return only valid JSON without any additional text or code block markers.`,
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingLevel: 'medium',
                            includeThoughts: false,
                        },
                    },
                },
            })

            try {
                const translated = parseChangelogTranslation(translationResult.text)

                translations.push({
                    changelogSlug: finalSlug,
                    locale,
                    title: translated.title,
                    markdown: translated.markdown,
                    aiGenerated: true,
                })
            } catch (error) {
                log.error(`Failed to parse translation for locale ${locale}:`, error)
                throw serverError.internalServerError({
                    responseMessage: 'Failed to generate changelog translations.',
                })
            }
        }
    } else {
        // Use provided i18n translations
        translations.push(
            ...i18n.map((translation) => ({
                changelogSlug: finalSlug,
                locale: translation.locale,
                title: translation.title,
                markdown: translation.markdown,
                html: translation.html,
                aiGenerated: translation.aiGenerated ?? false,
            })),
        )
    }

    const queries: BatchItem<'sqlite'>[] = [
        db.insert(changelogs).values({
            slug: finalSlug,
            title,
            markdown,
            idempotencyRequestId: idempotency.id,
        }),
    ]
    if (authors?.length)
        queries.push(
            db.insert(changelogAuthors).values(
                authors.map((author) => ({
                    changelogSlug: finalSlug,
                    userId: author,
                })),
            ),
        )
    if (translations.length) queries.push(db.insert(changelogI18ns).values(translations))
    queries.push(completeIdempotencyRequest(db, idempotency, { slug: finalSlug }))

    await executeD1Batch(db, queries)

    await purgeEdgeCacheTags(event, [EDGE_CACHE_TAGS.changelogs], 'changelog create')

    return {
        slug: finalSlug,
    }
})
