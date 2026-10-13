import { z } from 'zod'

export const adminReportQuerySchema = z.object({
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    reporterId: z.string().nullable().optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce
        .number()
        .min(1)
        .max(API_LIMIT_MAX)
        .optional()
        .default(ADMIN_REPORTS_API_DEFAULT_LIMIT),
    status: z.enum(['open', 'closed', 'all']).optional().default('all'),
})

export const getAdminReportResolvedFilter = (status: 'open' | 'closed' | 'all') =>
    status === 'open' ? { eq: false } : status === 'closed' ? { eq: true } : undefined
