import { user } from '@@/database/schema'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import { z } from 'zod'

const params = z.object({
    username: z.string(),
})
const body = userUpdateSchema

export default authedSessionEventHandler(async ({ session }) => {
    const { username: oldUsername } = await validateParams(params)
    const { username, name, image, bio, links } = await validateBody(body, {
        sanitize: true,
    })

    const data = await db.query.user.findFirst({
        where: {
            username: { eq: oldUsername },
            banned: { OR: [{ eq: false }, { isNull: true }] },
        },
        columns: {
            id: true,
            username: true,
        },
    })

    if (!data)
        throw createError({
            statusCode: StatusCodes.NOT_FOUND,
            statusMessage: getReasonPhrase(StatusCodes.NOT_FOUND),
        })

    if (data.id !== session.user.id && session.user.role !== 'admin')
        throw createError({
            statusCode: StatusCodes.FORBIDDEN,
            statusMessage: getReasonPhrase(StatusCodes.FORBIDDEN),
        })

    if (username) {
        const isUsernameAvailable = await auth.api.isUsernameAvailable({
            body: { username },
        })
        if (!isUsernameAvailable)
            throw createError({
                statusCode: StatusCodes.BAD_REQUEST,
                statusMessage: getReasonPhrase(StatusCodes.BAD_REQUEST),
            })
    }

    await db
        .update(user)
        .set({
            updatedAt: new Date(),
            username,
            name,
            image,
            bio,
            links,
        })
        .where(eq(user.id, data.id))

    consola.success(`User ${username} updated successfully`)

    await purgeUserCache(data.id)

    return null
})
