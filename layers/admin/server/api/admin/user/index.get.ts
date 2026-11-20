import { sql } from 'drizzle-orm'
import { EmptyFilter } from 'drizzle-orm/relations'
import { z } from 'zod'

const querySchema = z.object({
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional(),
    offset: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['createdAt', 'username', 'name']).optional().default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
    searchField: z.enum(['name', 'email', 'username']).optional(),
    searchOperator: z.enum(['contains', 'starts_with', 'ends_with']).optional(),
    searchValue: z.string().optional(),
    role: z.enum(['user', 'admin']).optional(),
    banned: z.stringbool().optional(),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireAdminSession(event)
    const {
        limit,
        offset,
        sortBy,
        sortDirection,
        searchField,
        searchOperator,
        searchValue,
        role,
        banned,
    } = await validateQuery(querySchema)

    const result = await db.query.users.findMany({
        limit,
        offset,
        orderBy: {
            [sortBy]: sortDirection,
        },
        where: {
            RAW: (table) =>
                searchValue
                    ? searchText(table[searchField ?? 'name'], searchValue, searchOperator)
                    : EmptyFilter,
            role:
                role === 'user'
                    ? { OR: [{ isNull: true }, { eq: 'user' }] }
                    : role === 'admin'
                      ? { eq: 'admin' }
                      : EmptyFilter,
            banned: banned
                ? { eq: true }
                : banned === false
                  ? { OR: [{ isNull: true }, { eq: false }] }
                  : EmptyFilter,
        },
        with: {
            badges: {
                columns: {
                    badge: true,
                    createdAt: true,
                },
            },
            publisherSourceOwnerships: {
                extras: {
                    count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
                },
                columns: {
                    id: true,
                },
            },
            setups: {
                extras: {
                    count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
                },
                columns: {
                    id: true,
                },
            },
        },
    })

    return result
})
