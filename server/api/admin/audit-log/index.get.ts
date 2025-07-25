import database from '@@/database'
import { auditLogs } from '@@/database/schema'
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

        const data = await database.query.auditLogs.findMany({
            extras: (table) => {
                const conditions = []

                if (q) conditions.push(ilike(table.details, `%${q}%`))

                if (userId) conditions.push(eq(table.userId, userId))

                if (action) conditions.push(eq(table.action, action))

                if (targetType)
                    conditions.push(eq(table.targetType, targetType))

                if (targetId) conditions.push(eq(table.targetId, targetId))

                return {
                    count: database
                        .$count(auditLogs, and(...conditions))
                        .as('count'),
                }
            },
            limit,
            offset,
            orderBy: (auditLogs, { asc, desc }) => {
                const sortFn = sort === 'desc' ? desc : asc
                return sortFn(auditLogs.createdAt)
            },
            where: (auditLogs, { and, eq, ilike }) => {
                const conditions = []

                if (q) conditions.push(ilike(auditLogs.details, `%${q}%`))

                if (userId) conditions.push(eq(auditLogs.userId, userId))

                if (action) conditions.push(eq(auditLogs.action, action))

                if (targetType)
                    conditions.push(eq(auditLogs.targetType, targetType))

                if (targetId) conditions.push(eq(auditLogs.targetId, targetId))

                return and(...conditions)
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
            data: data.map((log) => ({
                ...log,
                createdAt: log.createdAt.toISOString(),
                user: log.user
                    ? {
                          ...log.user,
                          createdAt: log.user?.createdAt.toISOString(),
                          badges: log.user?.badges.map((badge) => ({
                              ...badge,
                              createdAt: badge.createdAt.toISOString(),
                          })),
                          shops: log.user?.shops.map((shop) => ({
                              ...shop,
                              createdAt: shop.createdAt.toISOString(),
                          })),
                      }
                    : null,
            })),
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
