import { eq, exists } from 'drizzle-orm'
import { user } from '~~/database/schema'

export default defineApi<User[]>(
    async () => {
        const data = await db.query.user.findMany({
            where: {
                banned: { OR: [{ eq: false }, { isNull: true }] },
                setups: {
                    RAW: (table) =>
                        exists(
                            db
                                .select()
                                .from(table)
                                .where((setup) => eq(setup.userId, user.id))
                                .limit(1)
                        ),
                },
            },
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
