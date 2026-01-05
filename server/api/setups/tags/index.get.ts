import { asc, desc, ilike, sql } from 'drizzle-orm'
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

        const sortFn = sort === 'asc' ? asc : desc
        const orderByFn =
            orderBy === 'name' ? setupTags.tag : sql<number>`count(*)`

        const data = await db
            .select({
                tag: setupTags.tag,
                count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
            })
            .from(setupTags)
            .groupBy(setupTags.tag)
            .limit(limit)
            .orderBy(sortFn(orderByFn))
            .where(q ? ilike(setupTags.tag, `%${q}%`) : undefined)

        return data
    },
    {
        errorMessage: 'Failed to get tags.',
    }
)
