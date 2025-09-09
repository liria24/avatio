import database from '@@/database'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

const getUser = defineCachedFunction(
    async (id: string) => {
        const data = await database.query.user.findFirst({
            where: (user, { eq, or, and, isNull }) =>
                and(
                    eq(user.id, id),
                    or(eq(user.banned, false), isNull(user.banned))
                ),
            columns: {
                id: true,
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
        const { id } = await validateParams(params)

        return await getUser(id)
    },
    {
        errorMessage: 'Failed to get user',
    }
)
