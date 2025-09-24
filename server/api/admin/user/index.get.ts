import type { UserWithRole } from 'better-auth/plugins'
import { z } from 'zod'

const querySchema = z.object({
    limit: z.coerce.number().min(1).optional(),
    offset: z
        .string()
        .refine((val) => !isNaN(Number(val)))
        .optional(),
    sortBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
    searchField: z.enum(['name', 'email']).optional(),
    searchOperator: z.enum(['contains', 'starts_with', 'ends_with']).optional(),
    searchValue: z.string().optional(),
})

export default defineApi(
    async () => {
        const query = await validateQuery(querySchema)
        const { headers } = useEvent()

        const result = (await auth.api.listUsers({ headers, query })) as {
            users: UserWithRole[]
            total: number
            limit: number | undefined
            offset: number | undefined
        }

        return result
    },
    {
        errorMessage: 'Failed to list users',
        requireAdmin: true,
    }
)
