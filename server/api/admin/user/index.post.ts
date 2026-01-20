import { z } from 'zod'

const body = z.object({
    name: z.string(),
    email: z.email(),
    password: z.string().min(8),
    role: z.enum(['user', 'admin']),
})

export default adminSessionEventHandler(async () => {
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
})
