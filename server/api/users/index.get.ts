export default promiseEventHandler<User[]>(async () => {
    const data = await db.query.user.findMany({
        where: {
            banned: { OR: [{ eq: false }, { isNull: true }] },
            setups: true,
        },
        columns: {
            id: true,
            username: true,
            createdAt: true,
            name: true,
            image: true,
            bio: true,
            links: true,
        },
        with: {
            badges: {
                columns: {
                    badge: true,
                    createdAt: true,
                },
            },
            shops: {
                columns: {
                    id: true,
                    createdAt: true,
                },
                with: {
                    shop: {
                        columns: {
                            id: true,
                            platform: true,
                            name: true,
                            image: true,
                            verified: true,
                        },
                    },
                },
            },
        },
    })

    return data
})
