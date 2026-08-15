import { notifications } from '@@/database/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const body = z.object({
    id: z.uuid(),
})

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const { id } = await validateBody(body)

        const data = await db.query.notifications.findFirst({
            where: {
                id: { eq: id },
            },
            columns: {
                userId: true,
            },
        })

        if (!data) throw serverError.notFound()

        if (data.userId !== session.user.id) throw serverError.forbidden()

        const [updated] = await db
            .update(notifications)
            .set({
                readAt: new Date(),
            })
            .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)))
            .returning({ id: notifications.id })
        if (!updated) throw serverError.notFound()
    },
    { rejectBannedUser: true },
)
