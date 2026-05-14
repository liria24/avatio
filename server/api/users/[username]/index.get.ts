import { z } from 'zod'

const params = z.object({
    username: z.string(),
})

const getUser = defineCachedFunction(
    async (username: string) => await getPublicUser({ username }),
    {
        maxAge: USER_CACHE_TTL,
        name: 'user',
        getKey: (username: string) => username,
        swr: false,
    },
)

export default promiseEventHandler<User>(async () => {
    const { username } = await validateParams(params)

    defineCacheControl({ cdnAge: 60 * 30, clientAge: 60 })

    return await getUser(username)
})
