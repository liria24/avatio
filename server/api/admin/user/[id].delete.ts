import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default promiseEventHandler(async ({ event }) => {
    await requireUserSession(event, { user: { role: 'admin' } })
    const { id: userId } = await validateParams(params)
    const { headers } = event

    const result = await serverAuth(event).api.removeUser({ headers, body: { userId } })

    return result
})
