import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default adminSessionEventHandler(async ({ event }) => {
    const { id: userId } = await validateParams(params)
    const { headers } = event

    const result = await getAuth(event).api.removeUser({ headers, body: { userId } })

    return result
})
