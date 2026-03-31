import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

export default sessionEventHandler(async ({ session }) => {
    const { username } = await validateParams(params)

    const data = await db.query.users.findFirst({
        where: {
            username: { eq: username },
            banned: { OR: [{ eq: false }, { isNull: true }] },
        },
        columns: {
            id: true,
            username: true,
            name: true,
            image: true,
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
                            followers: session
                                ? {
                                      where: { userId: { eq: session.user.id } },
                                      columns: { id: true },
                                  }
                                : undefined,
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

    defineCacheControl({ cdnAge: 0, clientAge: 60 })

    return {
        user: {
            id: data.id,
            username: data.username,
            name: data.name,
            image: data.image,
        },
        followers: data.followers.map((user) => ({
            ...user.user,
            followers: undefined,
            isFollowing: !!user.user.followers.length,
        })),
    }
})
