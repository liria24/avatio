import { changelogAuthors, changelogs, changelogI18ns } from '@@/database/schema'
import type { BatchItem } from 'drizzle-orm/batch'
import { createInsertSchema } from 'drizzle-orm/zod'
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

export default promiseEventHandler(async ({ event, db }) => {
    const session = await requireUserSession(event, { user: { role: 'admin' } })
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
        const { changelogSlugGenerator } = useAiCapabilities(event)
        generatedSlug = await changelogSlugGenerator.generate({
            title,
            reservedSlugs: exists.map((entry) => entry.slug),
        })
        if (exists.some((entry) => entry.slug === generatedSlug))
            throw serverError.internalServerError({
                responseMessage: 'AI generated a duplicate changelog slug. Provide one manually.',
            })
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

            try {
                const { changelogTranslator } = useAiCapabilities(event)
                const translated = await changelogTranslator.translate({
                    title,
                    content: markdown,
                    sourceLocale: 'Japanese',
                    targetLocale: targetLanguage,
                })

                translations.push({
                    changelogSlug: finalSlug,
                    locale,
                    title: translated.title,
                    markdown: translated.content,
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

    await invalidateCacheResources(
        event,
        { collections: [EDGE_CACHE_TAGS.changelogs] },
        'changelog create',
    )

    return {
        slug: finalSlug,
    }
})
