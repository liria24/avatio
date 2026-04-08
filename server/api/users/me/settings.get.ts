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
            showNSFW: true,
        },
    })

    const result = defu(data, {
        updatedAt: null,
        showPrivateSetups: true,
        showNSFW: false,
    })

    return result
})
