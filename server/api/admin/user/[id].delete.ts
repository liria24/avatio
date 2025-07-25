import { auth } from '@@/better-auth'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default defineApi(
    async () => {
        const { id: userId } = await validateParams(params)
        const { headers } = useEvent()

        const result = await auth.api.removeUser({ headers, body: { userId } })

        return result
    },
    {
        errorMessage: 'Failed to remove user',
        requireAdmin: true,
    }
)
