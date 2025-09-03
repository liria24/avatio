import { auth } from '@@/better-auth'
import database from '@@/database'
import { user } from '@@/database/schema'

export default defineApi(
    async () => {
        const { headers } = useEvent()

        const [users, setups, items, feedbacks] = await Promise.all([
            auth.api.listUsers({ headers, query: {} }),
            database.query.setups.findMany({
                where: (setups, { eq, and, exists, or, isNull }) =>
                    and(
                        isNull(setups.hidAt),
                        exists(
                            database
                                .select()
                                .from(user)
                                .where(
                                    and(
                                        eq(user.id, setups.userId),
                                        or(
                                            eq(user.banned, false),
                                            isNull(user.banned)
                                        )
                                    )
                                )
                        )
                    ),
                columns: {
                    id: true,
                },
            }),
            database.query.items.findMany({
                where: (table, { eq }) => eq(table.outdated, false),
                columns: {
                    id: true,
                },
            }),
            database.query.feedbacks.findMany({
                columns: {
                    id: true,
                },
            }),
        ])

        return {
            users: users.total,
            setups: setups.length,
            items: items.length,
            feedbacks: feedbacks.length,
        }
    },
    {
        errorMessage: 'Failed to retrieve statistics',
        requireAdmin: true,
    }
)
