import { notifications } from '@@/database/schema'

const body = notificationsInsertSchema.pick({
    userId: true,
    title: true,
    type: true,
    message: true,
    data: true,
    actionUrl: true,
    actionLabel: true,
    banner: true,
})

export default adminSessionEventHandler(async () => {
    const { userId, title, type, message, data, actionUrl, actionLabel, banner } =
        await validateBody(body, { sanitize: true })

    const result = await db
        .insert(notifications)
        .values({
            userId,
            title,
            type,
            message,
            data,
            actionUrl,
            actionLabel,
            banner,
        })
        .returning({ id: notifications.id })

    return result[0]
})
