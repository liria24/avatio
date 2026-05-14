import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default promiseEventHandler<User>(async () => {
    const { id } = await validateParams(params)

    defineCacheControl({ cdnAge: 60 * 30, clientAge: 60 })

    return await getPublicUser({ id })
})
