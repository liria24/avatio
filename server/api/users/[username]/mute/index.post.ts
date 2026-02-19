import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { userMutes } from '~~/database/schema'

const params = z.object({
    username: z.string(),
})

export default authedSessionEventHandler(async ({ session }) => {
    const { username } = await validateParams(params)

    const muterId = session.user.id
    const muteeData = await db.query.user.findFirst({
        where: {
            username: { eq: username },
            banned: { OR: [{ eq: false }, { isNull: true }] },
        },
        columns: {
            id: true,
        },
    })

    if (!muteeData)
        throw createError({
            status: StatusCodes.NOT_FOUND,
            statusText: getReasonPhrase(StatusCodes.NOT_FOUND),
        })

    if (muteeData.id === muterId)
        throw createError({
            status: StatusCodes.BAD_REQUEST,
            statusText: getReasonPhrase(StatusCodes.BAD_REQUEST),
        })

    await db
        .insert(userMutes)
        .values({
            userId: muterId,
            muteeId: muteeData.id,
        })
        .onConflictDoNothing()

    return { success: true }
})
