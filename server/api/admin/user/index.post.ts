import { z } from 'zod'

const body = z.object({
    name: z.string(),
    email: z.email(),
    password: z.string().min(8),
    role: z.enum(['user', 'admin']),
})

export default promiseEventHandler(async ({ event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { name, email, password, role } = await validateBody(body)
    const { headers } = event

    const result = await serverAuth(event).api.createUser({
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
