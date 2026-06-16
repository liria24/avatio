import { sql } from 'drizzle-orm'

export default adminSessionEventHandler(async ({ db }) => {
    const { sort, reporterId, page, limit, status } = await validateQuery(adminReportQuerySchema)

    const offset = (page - 1) * limit

    const data = await db.query.itemReports.findMany({
        extras: {
            count: sql<number>`CAST(COUNT(*) OVER() AS INTEGER)`,
        },
        where: {
            reporterId: reporterId ? { eq: reporterId } : undefined,
            isResolved: getAdminReportResolvedFilter(status),
        },
        limit,
        offset,
        orderBy: {
            createdAt: sort,
        },
        columns: {
            id: true,
            createdAt: true,
            nameError: true,
            irrelevant: true,
            other: true,
            comment: true,
            isResolved: true,
        },
        with: {
            item: {
                columns: {
                    id: true,
                    platform: true,
                    category: true,
                    name: true,
                    niceName: true,
                    image: true,
                    price: true,
                    likes: true,
                    nsfw: true,
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
            reporter: {
                columns: {
                    id: true,
                    username: true,
                    name: true,
                    image: true,
                },
            },
        },
    })

    return {
        data,
        pagination: createPagination(data[0]?.count || 0, page, limit, offset),
    }
})
