import { changelogAuthors, changelogs, changelogsI18n } from '@@/database/schema'
import { generateText } from 'ai'
import { z } from 'zod'

const body = changelogsInsertSchema
    .pick({
        title: true,
        markdown: true,
    })
    .extend({
        slug: z.string().optional(),
        authors: z.string().array().optional(),
        i18n: changelogsI18nInsertSchema.array().optional(),
    })

export default adminSessionEventHandler(async () => {
    const { slug, title, markdown, authors, i18n } = await validateBody(body)
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

        const result = await generateText({
            model: 'google/gemini-3-flash',
            messages: [
                ...messages,
                {
                    role: 'user',
                    content: `Create a short slug for the blog with the title: ${title}`,
                },
            ],
            system: 'Please return only the slug as your answer.',
        })

        generatedSlug = result.text.trim()
    }

    const finalSlug = slug || generatedSlug

    await db.insert(changelogs).values({
        slug: finalSlug,
        title,
        markdown,
    })

    if (authors?.length)
        await db.insert(changelogAuthors).values(
            authors.map((author) => ({
                changelogSlug: finalSlug,
                userId: author,
            })),
        )

    // Handle i18n translations
    if (!i18n || i18n.length === 0) {
        // AI generate translations for both en and ja
        const locales: Array<'en'> = ['en']

        for (const locale of locales) {
            const targetLanguage = 'English'

            const translationResult = await generateText({
                model: 'google/gemini-3-flash',
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
            })

            try {
                const translated = JSON.parse(translationResult.text.trim())

                await db.insert(changelogsI18n).values({
                    changelogSlug: finalSlug,
                    locale,
                    title: translated.title,
                    markdown: translated.markdown,
                    aiGenerated: true,
                })
            } catch (error) {
                console.error(`Failed to parse translation for locale ${locale}:`, error)
            }
        }
    } else {
        // Use provided i18n translations
        await db.insert(changelogsI18n).values(
            i18n.map((translation) => ({
                changelogSlug: finalSlug,
                locale: translation.locale,
                title: translation.title,
                markdown: translation.markdown,
                html: translation.html,
                aiGenerated: translation.aiGenerated ?? false,
            })),
        )
    }

    return {
        slug: finalSlug,
    }
})
