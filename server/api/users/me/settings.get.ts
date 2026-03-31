import { defu } from 'defu'

export default authedSessionEventHandler(async ({ session }) => {
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
            notifPushEnabled: true,
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

    const result = defu(data, {
        updatedAt: null,
        showPrivateSetups: true,
        publicFollowees: false,
        publicBookmarks: false,
        notifSiteEnabled: true,
        notifSiteFollowed: true,
        notifSiteFolloweePost: true,
        notifSiteCoauthorAdded: true,
        notifPushEnabled: false,
        notifPushFollowed: true,
        notifPushFolloweePost: true,
        notifPushCoauthorAdded: true,
        notifWebhookEnabled: false,
        notifWebhookUrl: null,
        notifWebhookFollowed: true,
        notifWebhookFolloweePost: true,
        notifWebhookCoauthorAdded: true,
        showNSFW: false,
    })

    return result
})
