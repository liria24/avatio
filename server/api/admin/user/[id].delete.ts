import { waitUntil } from '@vercel/functions'
import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default adminSessionEventHandler(async () => {
    const { id: userId } = await validateParams(params)
    const { headers } = useEvent()

    const result = await auth.api.removeUser({ headers, body: { userId } })

    waitUntil(purgeUserCache(userId))

    return result
})
