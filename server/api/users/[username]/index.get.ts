import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

export default sessionEventHandler<User>(async ({ event, session, db }) => {
    const { username } = await validateParams(params)

    const visibility = await db.query.users.findFirst({
        where: {
            username: { eq: username },
        },
        columns: {
            id: true,
            banned: true,
        },
    })

    if (!visibility) throw serverError.notFound()

    const isPublic = !visibility.banned
    const canViewBanned = session?.user.role === 'admin' || session?.user.id === visibility.id
    if (!isPublic && !canViewBanned) throw serverError.notFound()

    const data = await db.query.users.findFirst({
        where: {
            id: { eq: visibility.id },
        },
        columns: {
            id: true,
            username: true,
            createdAt: true,
            name: true,
            image: true,
            bio: true,
            links: true,
            banned: true,
            banReason: true,
            banExpires: true,
        },
        with: {
            badges: {
                columns: {
                    badge: true,
                    createdAt: true,
                },
            },
            publisherSourceOwnerships: {
                columns: {
                    id: true,
                    method: true,
                    verifiedAt: true,
                },
                with: {
                    publisherSource: {
                        columns: {
                            id: true,
                            providerKey: true,
                            externalId: true,
                            canonicalUrl: true,
                            name: true,
                            image: true,
                            providerVerified: true,
                        },
                    },
                },
            },
        },
    })

    if (!data) throw serverError.notFound()

    const { banned, banReason, banExpires, publisherSourceOwnerships, ...user } = data
    const result = { ...user, publisherOwnerships: publisherSourceOwnerships }
    if (!isPublic) return { ...result, banned, banReason, banExpires }

    applyPublicEdgeCache(event, [EDGE_CACHE_TAGS.users])
    return result
})
