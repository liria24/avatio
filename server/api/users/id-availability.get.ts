import { z } from 'zod'

const query = z.object({
    id: z.string(),
})

export default defineApi<{
    available: boolean
}>(
    async () => {
        const { id } = await validateQuery(query)

        const data = await db.query.user.findFirst({
            where: {
                id: { eq: id },
            },
            columns: {
                id: true,
            },
        })

        return {
            available: !data,
        }
    },
    {
        errorMessage: 'Failed to check ID availability.',
    }
)
