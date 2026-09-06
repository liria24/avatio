export default authedSessionEventHandler(
    async ({ session }) => getPublisherRepository().listOwnerships(session.user.id),
    { rejectBannedUser: true },
)
