import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

export default sessionEventHandler<User[]>(async () => {
    const { username } = await validateParams(params)

    const data = await db.query.user.findFirst({
        where: {
            username: { eq: username },
            banned: { OR: [{ eq: false }, { isNull: true }] },
        },
        columns: {
            id: true,
            username: true,
        },
        with: {
            followers: {
                columns: {
                    id: true,
                },
                with: {
                    user: {
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

    defineCacheControl({ cdnAge: 60 * 30, clientAge: 60 })

    return data.followers.map((follower) => follower.user)
})
