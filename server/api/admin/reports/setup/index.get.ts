import { sql } from 'drizzle-orm'

export default adminSessionEventHandler(async ({ db }) => {
    const { sort, reporterId, page, limit, status } = await validateQuery(adminReportQuerySchema)

    const offset = (page - 1) * limit

    const data = await db.query.setupReports.findMany({
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
            spam: true,
            hate: true,
            infringe: true,
            badImage: true,
            other: true,
            comment: true,
            isResolved: true,
        },
        with: {
            setup: {
                columns: {
                    id: true,
                    createdAt: true,
                    updatedAt: true,
                    name: true,
                    description: true,
                    hidAt: true,
                    hidReason: true,
                },
                with: {
                    user: {
                        columns: {
                            id: true,
                            username: true,
                            name: true,
                            image: true,
                        },
                    },
                    images: {
                        columns: {
                            objectKey: true,
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
        data: await Promise.all(
            data.map(async (report) => ({
                ...report,
                setup: {
                    ...report.setup,
                    images: await withSetupImageUrls(report.setup.images),
                },
            })),
        ),
        pagination: createPagination(data[0]?.count || 0, page, limit, offset),
    }
})
