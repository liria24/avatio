import { or } from 'drizzle-orm'
import { EmptyFilter } from 'drizzle-orm/relations'
import { z } from 'zod'

const query = z.object({
    q: z.string().trim().min(1).optional(),
    limit: z.coerce.number().min(1).max(50).optional().default(24),
})

export default requestEventHandler<User[]>(async ({ event, db }) => {
    const { q, limit } = validateRequestQuery(event, query)

    const data = await db.query.users.findMany({
        limit,
        orderBy: {
            createdAt: 'desc',
        },
        where: {
            banned: { OR: [{ eq: false }, { isNull: true }] },
            setups: true,
            RAW: (table) =>
                q ? or(searchText(table.username, q), searchText(table.name, q))! : EmptyFilter,
        },
        columns: {
            id: true,
            username: true,
            name: true,
            image: true,
        },
        with: {
            badges: {
                columns: {
                    badge: true,
                    createdAt: true,
                },
            },
        },
    })

    applyPublicRequestCache(event, [EDGE_CACHE_TAGS.users])
    return data
})
