import { and, eq, ilike } from 'drizzle-orm'
import { z } from 'zod'

const query = z.object({
    q: z.string().optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    userId: z.string().nullable().optional(),
    action: auditActionTypeSchema.optional(),
    targetType: auditTargetTypeSchema.optional(),
    targetId: z.string().optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(1000).optional().default(24),
})

export default defineApi<PaginationResponse<AuditLog[]>>(
    async () => {
        const { q, sort, userId, action, targetType, targetId, page, limit } =
            await validateQuery(query)

        const offset = (page - 1) * limit

        const countConditions = []

        if (q) countConditions.push(ilike(schema.auditLogs.details, `%${q}%`))
        if (userId) countConditions.push(eq(schema.auditLogs.userId, userId))
        if (action) countConditions.push(eq(schema.auditLogs.action, action))
        if (targetType)
            countConditions.push(eq(schema.auditLogs.targetType, targetType))
        if (targetId)
            countConditions.push(eq(schema.auditLogs.targetId, targetId))

        const data = await db.query.auditLogs.findMany({
            extras: {
                count: db
                    .$count(schema.auditLogs, and(...countConditions))
                    .as('count'),
            },
            limit,
            offset,
            orderBy: {
                createdAt: sort,
            },
            where: {
                details: q ? { ilike: `%${q}%` } : undefined,
                userId: userId ? { eq: userId } : undefined,
                action: action ? { eq: action } : undefined,
                targetType: targetType ? { eq: targetType } : undefined,
                targetId: targetId ? { eq: targetId } : undefined,
            },
            columns: {
                id: true,
                createdAt: true,
                userId: true,
                action: true,
                targetType: true,
                targetId: true,
                details: true,
            },
            with: {
                user: {
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
                },
            },
        })

        return {
            data,
            pagination: {
                page,
                limit,
                total: data[0]?.count || 0,
                totalPages: Math.ceil((data[0]?.count || 0) / limit),
                hasNext: offset + limit < (data[0]?.count || 0),
                hasPrev: offset > 0,
            },
        }
    },
    {
        errorMessage: 'Failed to get audit log.',
        requireAdmin: true,
    }
)
