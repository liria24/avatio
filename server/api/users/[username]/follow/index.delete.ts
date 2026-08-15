import { and, eq } from 'drizzle-orm'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { userFollows } from '~~/database/schema'

const params = z.object({
    username: z.string(),
})

export default authedSessionEventHandler(async ({ event, session, db }) => {
    const { username } = await validateParams(params)

    const followerId = session.user.id
    await enforceRateLimit({
        binding: 'RATE_LIMIT_USER_ACTION',
        key: `relations:${followerId}`,
    })
    const followeeData = await db.query.users.findFirst({
        where: {
            username: { eq: username },
            banned: { OR: [{ eq: false }, { isNull: true }] },
        },
        columns: {
            id: true,
        },
    })

    if (!followeeData)
        throw createError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
        })

    if (followerId === followeeData.id)
        throw createError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
        })

    await db
        .delete(userFollows)
        .where(and(eq(userFollows.userId, followerId), eq(userFollows.followeeId, followeeData.id)))

    await Promise.all([
        purgeUserContentCache(event, db, followerId, 'unfollow user'),
        purgeUserContentCache(event, db, followeeData.id, 'unfollowed user'),
    ])

    return { success: true }
})
