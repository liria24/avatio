import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

type Args = { id: User['id']; cacheKey: string }

const getUser = defineCachedFunction(
    async (db: ReturnType<typeof useDB>, { id, cacheKey }: Args): Promise<User> => {
        const data = await db.query.users.findFirst({
            where: {
                id: { eq: id },
            },
            columns: {
                id: true,
                username: true,
                createdAt: true,
                name: true,
                image: true,
                bio: true,
                links: true,
                banned: true,
                banReason: true,
                banExpires: true,
            },
            with: {
                badges: {
                    columns: {
                        badge: true,
                        createdAt: true,
                    },
                },
                shops: {
                    columns: {
                        id: true,
                        createdAt: true,
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
                },
            },
        })

        if (!data) throw serverError.notFound()

        const { banned, banReason, banExpires, ...user } = data

        if (cacheKey.endsWith(':banned')) return { ...user, banned, banReason, banExpires }

        return user
    },
    {
        maxAge: USER_CACHE_TTL,
        name: 'user',
        getKey: (_db, { cacheKey }: Args) => cacheKey,
        swr: false,
    },
)

export default sessionEventHandler<User>(async ({ session, db }) => {
    const { username } = await validateParams(params)

    const visibility = await db.query.users.findFirst({
        where: {
            username: { eq: username },
        },
        columns: {
            id: true,
            banned: true,
        },
    })

    if (!visibility) throw serverError.notFound()

    const cacheKey = getUserCacheKey(visibility, session)
    if (!cacheKey) throw serverError.notFound()

    return await getUser(db, { id: visibility.id, cacheKey })
})
