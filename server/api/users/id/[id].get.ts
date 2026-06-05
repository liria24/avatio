import { z } from 'zod'

const params = z.object({
    id: z.string(),
})

export default promiseEventHandler<User>(async () => {
    const { id } = await validateParams(params)

    return await getPublicUser({ id })
})
