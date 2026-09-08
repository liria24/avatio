import { userSettings } from '~~/database/schema'

const request = {
    body: userSettingsUpdateSchema,
}

export default authedSessionEventHandler(
    async ({ event, session, db }) => {
        const body = await validateBody(request.body, { sanitize: true })

        await db
            .insert(userSettings)
            .values({
                ...body,
                userId: session.user.id,
            })
            .onConflictDoUpdate({
                target: [userSettings.userId],
                set: body,
            })

        await invalidateUserContentCache(event, db, session.user.id, 'user settings update')
        return { success: true }
    },
    { rejectBannedUser: true },
)
