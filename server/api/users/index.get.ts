import database from '@@/database'
import { setups } from '@@/database/schema'

export default defineApi<User[]>(
    async () => {
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

        return data
    },
    {
        errorMessage: 'Failed to get users',
    }
)
