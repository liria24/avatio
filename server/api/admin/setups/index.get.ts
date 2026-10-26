import { EmptyFilter } from 'drizzle-orm/relations'
import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    orderBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    username: z.string().optional(),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional(),
    private: z.stringbool().optional(),
    hidden: z.stringbool().optional(),
    banned: z.stringbool().optional(),
})

export default promiseEventHandler(async ({ db, event }) => {
    await requireAdminSession(event)
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
                username: username ? { eq: username } : EmptyFilter,
                banned: banned
                    ? { eq: true }
                    : banned === false
                      ? { OR: [{ eq: false }, { isNull: true }] }
                      : EmptyFilter,
            },
            RAW: (table) => (q ? searchText(table.name, q) : EmptyFilter),
            public: isPrivate !== undefined ? { eq: !isPrivate } : EmptyFilter,
            hidAt: hidden ? { isNotNull: true } : hidden === false ? { isNull: true } : EmptyFilter,
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
                orderBy: { position: 'asc' },
                columns: {
                    id: true,
                    stableId: true,
                    position: true,
                    objectKey: true,
                },
            },
        },
    })

    return await Promise.all(
        result.map(async (setup) => ({
            ...setup,
            images: await withSetupImageUrls(setup.images),
        })),
    )
})
