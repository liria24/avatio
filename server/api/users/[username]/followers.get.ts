import { eq } from 'drizzle-orm'
import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import { z } from 'zod'
import { userFollows } from '~~/database/schema'

const params = z.object({
    username: z.string(),
})
const query = z.object({
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(API_LIMIT_MAX).optional().default(50),
})

export default sessionEventHandler(async ({ session, db }) => {
    const { username } = await validateParams(params)
    const { page, limit } = await validateQuery(query)
    const offset = (page - 1) * limit

    const user = await db.query.users.findFirst({
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
    })

    if (!user)
        throw createError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
        })

    const [total, followers] = await Promise.all([
        db.$count(userFollows, eq(userFollows.followeeId, user.id)),
        db.query.userFollows.findMany({
            limit,
            offset,
            orderBy: {
                createdAt: 'desc',
            },
            where: {
                followeeId: { eq: user.id },
                user: {
                    OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
                },
            },
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
        }),
    ])

    return {
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            image: user.image,
        },
        followers: followers.map((user) => ({
            ...user.user,
            followers: undefined,
            isFollowing: !!user.user.followers?.length,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: offset + limit < total,
            hasPrev: offset > 0,
        },
    }
})
