import database from '@@/database'
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

export default defineApi(
    async () => {
        const { slug, title, markdown, authors } = await validateBody(body)

        const html = await marked.parse(markdown, {
            gfm: true,
            breaks: true,
        })

        const data = await database
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

        if (authors?.length)
            await database.insert(changelogAuthors).values(
                authors.map((author) => ({
                    changelogSlug: data[0].slug,
                    userId: author,
                }))
            )

        return data[0]
    },
    {
        errorMessage: 'Failed to create changelog.',
        requireAdmin: true,
    }
)
