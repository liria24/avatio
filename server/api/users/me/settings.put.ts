import { userSettings } from '~~/database/schema'

const request = {
    body: userSettingsUpdateSchema,
}

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const body = await validateBody(request.body)

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

        await purgeUserSettingsSessionCache(session.user.id)

        return { success: true }
    },
    { rejectBannedUser: true },
)
