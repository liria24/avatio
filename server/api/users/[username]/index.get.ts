import { StatusCodes, getReasonPhrase } from 'http-status-codes'
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
                id: true,
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
                status: StatusCodes.NOT_FOUND,
                statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
            })

        return data
    },
    {
        maxAge: USER_CACHE_TTL,
        name: 'user',
        getKey: (id: string) => id,
        swr: false,
    }
)

export default promiseEventHandler<User>(async () => {
    const { username } = await validateParams(params)

    defineCacheControl({ cdnAge: 60 * 30, clientAge: 60 })

    return await getUser(username)
})
