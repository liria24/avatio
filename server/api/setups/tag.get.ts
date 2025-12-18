import { z } from 'zod'
import { setupTags } from '~~/database/schema'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['name', 'count']).optional().default('count'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi(
    async () => {
        const { q, orderBy, sort, limit } = await validateQuery(query)

        const data = await db.query.setupTags.findMany({
            where: {
                tag: q ? { ilike: `%${q}%` } : undefined,
            },
            orderBy: {
                [orderBy]: sort,
            },
            limit,
            columns: {
                tag: true,
            },
            extras: {
                count: db.$count(setupTags.tag).as('count'),
            },
        })

        return data
    },
    {
        errorMessage: 'Failed to get tags.',
    }
)
