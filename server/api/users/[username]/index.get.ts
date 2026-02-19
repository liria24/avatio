import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

export default sessionEventHandler<User>(async ({ session }) => {
    const { username } = await validateParams(params)

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
            followers: {
                columns: {
                    userId: true,
                },
            },
            followees: {
                columns: {
                    userId: true,
                },
            },
            settings: {
                columns: {
                    publicFollows: true,
                },
            },
        },
    })

    if (!data)
        throw createError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
        })

    const followeesCount =
        session?.user.id === data.id || data.settings?.publicFollows
            ? data.followees.length
            : undefined

    const isFollowing: boolean = session
        ? data.followers.some((f) => f.userId === session.user.id)
        : false

    defineCacheControl({ cdnAge: 60 * 30, clientAge: 60 })

    return {
        ...data,
        followersCount: data.followers.length,
        followeesCount,
        followers: undefined,
        followees: undefined,
        isFollowing,
        settings: undefined,
    }
})
