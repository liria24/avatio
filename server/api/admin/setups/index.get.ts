import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    username: z.string().optional(),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional().default(SETUPS_API_DEFAULT_LIMIT),
})

export default adminSessionEventHandler(async () => {
    const { q, orderBy, sort, username, limit } = await validateQuery(query)

    const result = await db.query.setups.findMany({
        limit,
        where: {
            // hidAt: { isNull: true },
            user: {
                // OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                username: username ? { eq: username } : undefined,
            },
            name: q ? { ilike: `%${q}%` } : undefined,
        },
        orderBy: {
            [orderBy]: sort,
        },
        columns: {
            id: true,
            createdAt: true,
            updatedAt: true,
            name: true,
            hidAt: true,
        },
        with: {
            user: {
                columns: {
                    username: true,
                    name: true,
                    image: true,
                },
            },
            images: {
                columns: {
                    url: true,
                },
            },
        },
    })

    return result
})
