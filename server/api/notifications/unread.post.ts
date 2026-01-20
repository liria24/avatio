import { notifications } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const body = z.object({
    id: z.uuid(),
})

export default authedSessionEventHandler(async ({ session }) => {
    const { id } = await validateBody(body)

    const data = await db.query.notifications.findFirst({
        where: {
            id: { eq: id },
        },
        columns: {
            userId: true,
        },
    })

    if (!data)
        throw createError({
            statusCode: 404,
            statusMessage: 'Notification not found.',
        })

    if (data.userId !== session.user.id)
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden.',
        })

    await db
        .update(notifications)
        .set({
            readAt: null,
        })
        .where(eq(notifications.id, id))
})
