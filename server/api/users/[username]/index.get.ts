import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

const getUser = defineCachedFunction(
    async (username: string) => {
        const data = await db.query.user.findFirst({
            where: {
                username: { eq: username },
                banned: { OR: [{ eq: false }, { isNull: true }] },
            },
            columns: {
                username: true,
                createdAt: true,
                name: true,
                image: true,
                bio: true,
                links: true,
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

        if (!data)
            throw createError({
                statusCode: 404,
                statusMessage: 'User not found',
            })

        return data
    },
    {
        maxAge: 60 * 60, // 1 hour
        name: 'user',
        getKey: (id: string) => id,
        swr: false,
    }
)

export default defineApi<User>(
    async () => {
        const { username } = await validateParams(params)

        return await getUser(username)
    },
    {
        errorMessage: 'Failed to get user',
    }
)
