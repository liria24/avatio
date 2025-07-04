import database from '@@/database'
import { setupTags } from '@@/database/schema'
import { asc, count, desc, ilike } from 'drizzle-orm'
import { z } from 'zod/v4'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['name', 'count']).optional().default('count'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi(
    async () => {
        const { q, orderBy, sort, limit } = await validateQuery(query)

        const data = await database
            .select({
                tag: setupTags.tag,
                count: count(setupTags.tag).as('count'),
            })
            .from(setupTags)
            .groupBy(setupTags.tag)
            .where((setupTags) => {
                if (q) return ilike(setupTags.tag, `%${q}%`)
            })
            .orderBy((setupTags) => {
                const sortFn = sort === 'desc' ? desc : asc
                switch (orderBy) {
                    case 'name':
                        return sortFn(setupTags.tag)
                    default:
                        return sortFn(count(setupTags.tag))
                }
            })
            .limit(limit)

        return data
    },
    {
        errorMessage: 'Failed to get tags.',
    }
)
