import { z } from 'zod'

const query = z.object({
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(OWNED_AVATARS_API_DEFAULT_LIMIT),
})

export default authedSessionEventHandler<Item[]>(async ({ session, db }) => {
    const { limit } = await validateQuery(query)

    const [data, outdatedItems] = await Promise.all([
        db.query.items.findMany({
            where: {
                outdated: { eq: false },
                category: { eq: 'avatar' },
                setupItems: {
                    setup: {
                        userId: { eq: session.user.id },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            limit,
        }),

        db.query.items.findMany({
            where: {
                outdated: { eq: true },
                category: { eq: 'avatar' },
                setupItems: {
                    setup: {
                        userId: { eq: session.user.id },
                    },
                },
            },
            columns: {
                id: true,
                platform: true,
                updatedAt: true,
            },
            limit,
        }),
    ])

    runAfterResponse(
        enqueueReferencedCatalogSources(
            [...data, ...outdatedItems].map(({ id, platform }) => ({ id, platform })),
        ),
    )

    return data
})
