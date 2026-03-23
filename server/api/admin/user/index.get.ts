import { z } from 'zod'

const querySchema = z.object({
    limit: z.coerce.number().min(1).optional(),
    offset: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
    searchField: z.enum(['name', 'email']).optional(),
    searchOperator: z.enum(['contains', 'starts_with', 'ends_with']).optional(),
    searchValue: z.string().optional(),
})

export default adminSessionEventHandler(async () => {
    const { limit, offset, sortBy, sortDirection, searchField, searchOperator, searchValue } =
        await validateQuery(querySchema)

    const result = await db.query.users.findMany({
        limit,
        offset,
        orderBy: {
            [sortBy]: sortDirection,
        },
        where: {
            [searchField ?? 'name']: searchValue
                ? { [searchOperator ?? 'contains']: searchValue }
                : undefined,
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

    return result
})
