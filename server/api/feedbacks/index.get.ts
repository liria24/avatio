export default adminSessionEventHandler<Feedback[]>(async () => {
    const data = await db.query.feedbacks.findMany({
        orderBy: {
            createdAt: 'desc',
        },
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
})
