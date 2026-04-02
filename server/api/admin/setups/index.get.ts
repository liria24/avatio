import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    username: z.string().optional(),
    limit: z.coerce.number().min(1).optional(),
    private: z.stringbool().optional(),
    hidden: z.stringbool().optional(),
    banned: z.stringbool().optional(),
})

export default adminSessionEventHandler(async () => {
    const {
        q,
        orderBy,
        sort,
        username,
        limit,
        hidden,
        banned,
        private: isPrivate,
    } = await validateQuery(query)

    const result = await db.query.setups.findMany({
        limit,
        where: {
            user: {
                // OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                username: username ? { eq: username } : undefined,
            },
            name: q ? { ilike: `%${q}%` } : undefined,
            public: isPrivate !== undefined ? { eq: !isPrivate } : undefined,
            hidAt: hidden ? { isNotNull: true } : hidden === false ? { isNull: true } : undefined,
            banned: banned ? { eq: true } : banned === false ? { eq: false } : undefined,
        },
        orderBy: {
            [orderBy]: sort,
        },
        columns: {
            id: true,
            public: true,
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
