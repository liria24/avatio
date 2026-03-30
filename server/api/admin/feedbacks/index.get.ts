import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    fingerprint: z.string().optional(),
    limit: z.coerce.number().min(1).optional(),
    status: z.enum(['open', 'closed', 'all']).optional().default('all'),
})

export default adminSessionEventHandler<Feedback[]>(async () => {
    const { q, sort, fingerprint, limit, status } = await validateQuery(query)

    const data = await db.query.feedbacks.findMany({
        limit,
        where: {
            fingerprint: fingerprint ? { eq: fingerprint } : undefined,
            comment: q ? { ilike: `%${q}%` } : undefined,
            isClosed:
                status === 'open' ? { eq: false } : status === 'closed' ? { eq: true } : undefined,
        },
        orderBy: {
            createdAt: sort,
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
