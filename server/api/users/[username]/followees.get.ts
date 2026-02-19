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
            settings: {
                columns: {
                    publicFollowees: true,
                },
            },
            followees: {
                columns: {
                    id: true,
                },
                with: {
                    followee: {
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

    if (!data.settings?.publicFollowees && session?.user.username !== username)
        throw createError({
            status: StatusCodes.FORBIDDEN,
            statusText: getReasonPhrase(StatusCodes.FORBIDDEN),
        })

    defineCacheControl({ cdnAge: 0, clientAge: 60 })

    return {
        user: {
            id: data.id,
            username: data.username,
            name: data.name,
            image: data.image,
        },
        followees: data.followees.map((user) => ({
            ...user.followee,
            followers: undefined,
            isFollowing: !!user.followee.followers.length,
        })),
    }
})
