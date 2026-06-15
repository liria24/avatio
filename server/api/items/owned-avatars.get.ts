import { z } from 'zod'

const query = z.object({
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(OWNED_AVATARS_API_DEFAULT_LIMIT),
})

export default authedSessionEventHandler<Item[]>(async ({ event, session, db }) => {
    const { limit } = await validateQuery(query)

    const data = await db.query.items.findMany({
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
    })

    if (data.length)
        runAfterResponse(
            Promise.all(data.map((item) => enqueueItemRevalidation(event, item, 'owned-avatars'))),
        )

    return data
})
