import { auth } from '@@/better-auth'
import { z } from 'zod/v4'

const body = z.object({
    name: z.string(),
    email: z.email(),
    password: z.string().min(8),
    role: z.enum(['user', 'admin']),
})

export default defineApi(
    async () => {
        const { name, email, password, role } = await validateBody(body)
        const { headers } = useEvent()

        const result = await auth.api.createUser({
            headers,
            body: {
                name,
                email,
                password,
                role,
            },
        })

        return result
    },
    {
        errorMessage: 'Failed to create user',
        requireAdmin: true,
    }
)
