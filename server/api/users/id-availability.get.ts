import database from '@@/database'
import { z } from 'zod'

const query = z.object({
    id: z.string(),
})

export default defineApi<{
    available: boolean
}>(
    async () => {
        const { id } = await validateQuery(query)

        const data = await database.query.user.findFirst({
            where: (user, { eq }) => eq(user.id, id),
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
