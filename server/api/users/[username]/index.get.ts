import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

export default sessionEventHandler<User>(async ({ session }) => {
    const { username } = await validateParams(params)

    const [user, mute] = await Promise.all([
        db.query.users.findFirst({
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
        }),
        db.query.userMutes.findFirst({
            where: {
                userId: { eq: session?.user.id },
                mutee: {
                    username: { eq: username },
                },
            },
            columns: {
                createdAt: true,
            },
        }),
    ])

    if (!user)
        throw createError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
        })

    const followeesCount =
        session?.user.id === user.id || user.settings?.publicFollows
            ? user.followees.length
            : undefined

    const isFollowing: boolean = session
        ? user.followers.some((f) => f.userId === session.user.id)
        : false

    defineCacheControl({ cdnAge: 60 * 30, clientAge: 60 })

    return {
        ...user,
        followersCount: user.followers.length,
        followeesCount,
        followers: undefined,
        followees: undefined,
        isFollowing,
        isMuted: !!mute,
        settings: undefined,
    }
})
