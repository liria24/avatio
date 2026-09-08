export default authedSessionEventHandler(async ({ session, db }) => {
    const data = await db.query.userSettings.findFirst({
        where: {
            userId: { eq: session.user.id },
            user: true,
        },
        columns: {
            updatedAt: true,
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

    return {
        ...userSettingsDefaults,
        ...data,
    }
})
