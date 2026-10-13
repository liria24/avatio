export default authedSessionEventHandler(async ({ session, db }) => {
    const data = await db.query.userSettings.findFirst({
        where: {
            userId: { eq: session.user.id },
            user: true,
        },
        columns: {
            updatedAt: true,
            showPrivateSetups: true,
            showNSFW: true,
        },
    })

    return {
        updatedAt: data?.updatedAt ?? null,
        showPrivateSetups: data?.showPrivateSetups ?? true,
        showNSFW: data?.showNSFW ?? false,
    }
})
