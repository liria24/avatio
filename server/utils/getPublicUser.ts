type PublicUserLookup = { id: string; username?: never } | { id?: never; username: string }

export const getPublicUser = async (lookup: PublicUserLookup): Promise<User> => {
    const where = lookup.id ? { id: { eq: lookup.id } } : { username: { eq: lookup.username } }

    const data = await db.query.users.findFirst({
        where: {
            ...where,
            banned: { OR: [{ eq: false }, { isNull: true }] },
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

    if (!data) throw serverError.notFound()

    return data
}
