import { changelogAuthors, changelogs } from '@@/database/schema'
import { marked } from 'marked'
import { z } from 'zod'

const body = changelogsInsertSchema
    .pick({
        slug: true,
        title: true,
        markdown: true,
    })
    .extend({
        authors: z.string().array().optional(),
    })

export default adminSessionEventHandler(async () => {
    const { slug, title, markdown, authors } = await validateBody(body)

    const html = await marked.parse(markdown, {
        gfm: true,
        breaks: true,
    })

    const [data] = await db
        .insert(changelogs)
        .values({
            slug,
            title,
            markdown,
            html,
        })
        .returning({
            slug: changelogs.slug,
        })

    if (!data) throw new Error('Changelog creation failed')

    if (authors?.length)
        await db.insert(changelogAuthors).values(
            authors.map((author) => ({
                changelogSlug: data?.slug,
                userId: author,
            }))
        )

    return data
})
