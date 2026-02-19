import { and, eq } from 'drizzle-orm'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { userFollows } from '~~/database/schema'

const params = z.object({
    username: z.string(),
})

export default authedSessionEventHandler(async ({ session }) => {
    const { username } = await validateParams(params)

    const followerId = session.user.id
    const followeeData = await db.query.user.findFirst({
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

    return { success: true }
})
