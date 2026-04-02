import { sql } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
    limit: z.coerce.number().min(1).optional(),
    offset: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['createdAt', 'username', 'name']).optional().default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
    searchField: z.enum(['name', 'email', 'username']).optional(),
    searchOperator: z.enum(['contains', 'starts_with', 'ends_with']).optional(),
    searchValue: z.string().optional(),
    role: z.enum(['user', 'admin']).optional(),
    banned: z.stringbool().optional(),
})

export default adminSessionEventHandler(async () => {
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

    const searchPattern = searchValue
        ? searchOperator === 'starts_with'
            ? `${searchValue}%`
            : searchOperator === 'ends_with'
              ? `%${searchValue}`
              : `%${searchValue}%`
        : undefined

    const result = await db.query.users.findMany({
        limit,
        offset,
        orderBy: {
            [sortBy]: sortDirection,
        },
        where: {
            name:
                searchValue && (!searchField || searchField === 'name')
                    ? { ilike: searchPattern! }
                    : undefined,
            email: searchValue && searchField === 'email' ? { ilike: searchPattern! } : undefined,
            username:
                searchValue && searchField === 'username' ? { ilike: searchPattern! } : undefined,
            role:
                role === 'user'
                    ? { OR: [{ isNull: true }, { eq: 'user' }] }
                    : role === 'admin'
                      ? { eq: 'admin' }
                      : undefined,
            banned: banned
                ? { eq: true }
                : banned === false
                  ? { OR: [{ isNull: true }, { eq: false }] }
                  : undefined,
        },
        with: {
            badges: {
                columns: {
                    badge: true,
                    createdAt: true,
                },
            },
            shops: {
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
