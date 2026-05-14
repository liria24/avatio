import { userSettings } from '~~/database/schema'

const request = {
    body: userSettingsUpdateSchema,
}

export default authedSessionEventHandler(
    async ({ session }) => {
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

        return { success: true }
    },
    { rejectBannedUser: true },
)
