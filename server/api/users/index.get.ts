import database from '@@/database'
import { setups } from '@@/database/schema'

export default defineApi<
    User[],
    {
        errorMessage: 'Failed to get users'
    }
>(async () => {
    const data = await database.query.user.findMany({
        where: (user, { eq, or, and, isNull, exists }) =>
            and(
                exists(
                    database
                        .select()
                        .from(setups)
                        .where((setup) => eq(setup.userId, user.id))
                        .limit(1)
                ),
                or(eq(user.banned, false), isNull(user.banned))
            ),
        columns: {
            id: true,
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

    return data.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        badges: user.badges?.map((badge) => ({
            ...badge,
            createdAt: badge.createdAt.toISOString(),
        })),
        shops: user.shops?.map((shop) => ({
            ...shop,
            createdAt: shop.createdAt.toISOString(),
        })),
    }))
})
