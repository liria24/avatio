import database from '@@/database'

export default defineApi<Feedback[]>(
    async () => {
        const data = await database.query.feedbacks.findMany({
            orderBy: (table, { desc }) => desc(table.createdAt),
            columns: {
                id: true,
                createdAt: true,
                fingerprint: true,
                contextPath: true,
                comment: true,
                isClosed: true,
            },
        })

        return data
    },
    {
        errorMessage: 'Failed to get feedbacks.',
        requireAdmin: true,
    }
)
