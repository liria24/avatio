import database from '@@/database'

export default defineApi<
    Feedback[],
    {
        errorMessage: 'Failed to get feedbacks.'
        requireAdmin: true
    }
>(async () => {
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

    return data.map((feedback) => ({
        ...feedback,
        createdAt: feedback.createdAt.toISOString(),
    }))
})
