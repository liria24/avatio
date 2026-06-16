import { z } from 'zod'

const query = z.object({
    q: z.string().trim().min(1).optional(),
    limit: z.coerce.number().min(1).max(50).optional().default(24),
})

export default promiseEventHandler<User[]>(async ({ db }) => {
    const { q, limit } = await validateQuery(query)

    const data = await db.query.users.findMany({
        limit,
        orderBy: {
            createdAt: 'desc',
        },
        where: {
            banned: { OR: [{ eq: false }, { isNull: true }] },
            setups: true,
            OR: q
                ? [{ username: { ilike: `%${q}%` } }, { name: { ilike: `%${q}%` } }]
                : undefined,
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

    return data
})
