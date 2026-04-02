import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.coerce.number().min(1).optional(),
    platform: platformSchema.optional(),
    outdated: z.stringbool().optional(),
})

export default adminSessionEventHandler(async () => {
    const { q, orderBy, sort, limit, platform, outdated } = await validateQuery(query)

    const result = await db.query.items.findMany({
        limit,
        where: {
            name: q ? { ilike: `%${q}%` } : undefined,
            platform: platform ? { eq: platform } : undefined,
            outdated: outdated ? { eq: true } : outdated === false ? { eq: false } : undefined,
        },
        orderBy: {
            [orderBy]: sort,
        },
        columns: {
            id: true,
            createdAt: true,
            updatedAt: true,
            platform: true,
            category: true,
            name: true,
            niceName: true,
            image: true,
            price: true,
            likes: true,
            nsfw: true,
            outdated: true,
        },
        with: {
            shop: {
                columns: {
                    id: true,
                    platform: true,
                    name: true,
                    image: true,
                    verified: true,
                },
            },
        },
    })

    return result
})
