import { sql } from 'drizzle-orm'

export default promiseEventHandler(async ({ db, event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
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
            item: { with: catalogItemRelations },
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
        data: data.map((row) => ({ ...row, item: projectCatalogItem(row.item) })),
        pagination: createPagination(data[0]?.count || 0, page, limit, offset),
    }
})
