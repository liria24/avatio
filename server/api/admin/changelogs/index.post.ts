import { changelogAuthors, changelogs } from '@@/database/schema'
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

    // TODO: Handle i18n

    await db.insert(changelogs).values({
        slug: slug || generatedSlug,
        title,
        markdown,
    })

    if (authors?.length)
        await db.insert(changelogAuthors).values(
            authors.map((author) => ({
                changelogSlug: slug || generatedSlug,
                userId: author,
            })),
        )

    return {
        slug: slug || generatedSlug,
    }
})
