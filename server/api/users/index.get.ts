export default promiseEventHandler<User[]>(async () => {
    const data = await db.query.users.findMany({
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
        },
    })

    return data
})
