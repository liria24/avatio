import { waitUntil } from '@vercel/functions'
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

    try {
        await db.insert(userFollows).values({
            userId: followerId,
            followeeId: followeeData.id,
        })
    } catch {
        throw createError({
            status: StatusCodes.CONFLICT,
            statusText: getReasonPhrase(StatusCodes.CONFLICT),
        })
    }

    waitUntil(
        (async () => {
            await createNotification({
                userId: followeeData.id,
                type: 'user_followed',
                payload: {
                    user: {
                        username: session.user.username,
                        name: session.user.name,
                    },
                },
            })
        })(),
    )

    return { success: true }
})
