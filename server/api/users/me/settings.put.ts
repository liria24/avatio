import { userSettings } from '~~/database/schema'

const request = {
    body: userSettingsUpdateSchema,
}

export default authedSessionEventHandler(
    async ({ session, db }) => {
        const body = await validateBody(request.body)
        const current = await db.query.userSettings.findFirst({
            where: {
                userId: { eq: session.user.id },
            },
            columns: {
                showPrivateSetups: true,
                publicFollowees: true,
                publicBookmarks: true,
                notifSiteEnabled: true,
                notifSiteFollowed: true,
                notifSiteFolloweePost: true,
                notifSiteCoauthorAdded: true,
                notifPushFollowed: true,
                notifPushFolloweePost: true,
                notifPushCoauthorAdded: true,
                notifWebhookEnabled: true,
                notifWebhookUrl: true,
                notifWebhookFollowed: true,
                notifWebhookFolloweePost: true,
                notifWebhookCoauthorAdded: true,
                showNSFW: true,
            },
        })
        const updatedAt = new Date()

        await db
            .insert(userSettings)
            .values({
                ...userSettingsDefaults,
                updatedAt,
                ...current,
                ...body,
                userId: session.user.id,
            })
            .onConflictDoUpdate({
                target: [userSettings.userId],
                set: {
                    ...body,
                    updatedAt,
                },
            })

        await purgeUserSettingsSessionCache(session.user.id)

        return { success: true }
    },
    { rejectBannedUser: true },
)
